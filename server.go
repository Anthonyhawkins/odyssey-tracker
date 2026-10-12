package main

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

//go:embed index.html map.png assets/*
var webAssets embed.FS

type appServer struct {
	mu                          sync.Mutex
	dataDir, projectsDir, token string
	config                      Config
}
type projectEntry struct {
	File  string `json:"file"`
	Title string `json:"title"`
	Error string `json:"error,omitempty"`
}
type projectResponse struct {
	File     string   `json:"file"`
	Revision string   `json:"revision"`
	Document Document `json:"document"`
	Warning  string   `json:"warning,omitempty"`
}

func newAppServer(dir string) (*appServer, error) {
	if err := os.MkdirAll(dir, 0700); err != nil {
		return nil, err
	}
	c, err := loadConfig(dir)
	if err != nil {
		return nil, err
	}
	projects := c.ProjectsDir
	if !filepath.IsAbs(projects) {
		projects = filepath.Join(dir, projects)
	}
	if err := os.MkdirAll(projects, 0700); err != nil {
		return nil, err
	}
	var key [32]byte
	if _, err := rand.Read(key[:]); err != nil {
		return nil, err
	}
	return &appServer{dataDir: dir, projectsDir: projects, config: c, token: hex.EncodeToString(key[:])}, nil
}
func revision(b []byte) string { v := sha256.Sum256(b); return hex.EncodeToString(v[:]) }
func (s *appServer) readProject(file string) (Document, string, error) {
	var d Document
	if !validFilename(file) {
		return d, "", fmt.Errorf("invalid project filename")
	}
	name := filepath.Join(s.projectsDir, file)
	stat, err := os.Lstat(name)
	if err != nil {
		return d, "", err
	}
	if !stat.Mode().IsRegular() {
		return d, "", fmt.Errorf("project must be a regular JSON file")
	}
	if stat.Size() > 16<<20 {
		return d, "", fmt.Errorf("project exceeds 16 MiB")
	}
	b, err := os.ReadFile(name)
	if err != nil {
		return d, "", err
	}
	if err := json.Unmarshal(b, &d); err != nil {
		return d, "", fmt.Errorf("invalid JSON: %w", err)
	}
	if _, err := validateDocument(&d); err != nil {
		return d, "", err
	}
	return d, revision(b), nil
}
func (s *appServer) entries() ([]projectEntry, error) {
	list, err := os.ReadDir(s.projectsDir)
	if err != nil {
		return nil, err
	}
	entries := []projectEntry{}
	for _, item := range list {
		if !validFilename(item.Name()) || !item.Type().IsRegular() {
			continue
		}
		d, _, err := s.readProject(item.Name())
		entry := projectEntry{File: item.Name(), Title: item.Name()}
		if err != nil {
			entry.Error = err.Error()
		} else {
			var p projectFields
			_ = json.Unmarshal(d.Project, &p)
			entry.Title = p.Title
		}
		entries = append(entries, entry)
	}
	return entries, nil
}
func (s *appServer) remember(file string) error {
	c := s.config
	c.LastProject = file
	if err := writeConfig(s.dataDir, c); err != nil {
		return err
	}
	s.config = c
	return nil
}
func (s *appServer) bootstrap() map[string]any {
	result := map[string]any{"token": s.token, "welcome": !s.config.WelcomeSeen, "background": s.config.Background, "projects": []projectEntry{}, "current": nil, "dataDir": s.dataDir}
	entries, err := s.entries()
	if err == nil {
		result["projects"] = entries
	} else {
		result["warning"] = "Cannot list projects: " + err.Error()
	}
	if file := s.config.LastProject; file != "" {
		d, rev, err := s.readProject(file)
		if err != nil {
			result["warning"] = "The last project could not be opened: " + err.Error()
		} else {
			result["current"] = projectResponse{File: file, Revision: rev, Document: d}
		}
	}
	return result
}
func sendJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func problem(w http.ResponseWriter, status int, err error) {
	sendJSON(w, status, map[string]string{"error": err.Error()})
}
func (s *appServer) decode(w http.ResponseWriter, r *http.Request) (Document, bool) {
	var d Document
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<20))
	if err := decoder.Decode(&d); err != nil {
		problem(w, 400, err)
		return d, false
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		problem(w, 400, fmt.Errorf("send one JSON document"))
		return d, false
	}
	if _, err := validateDocument(&d); err != nil {
		problem(w, 400, err)
		return d, false
	}
	return d, true
}
func (s *appServer) handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) })
	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		s.mu.Lock()
		bootstrap := s.bootstrap()
		s.mu.Unlock()
		b, _ := webAssets.ReadFile("index.html")
		data, _ := json.Marshal(bootstrap)
		// encoding/json escapes '<', preventing user text from ending this script.
		script := append([]byte("<script>window.odysseyBootstrap="), data...)
		script = append(script, []byte(";</script>")...)
		b = bytes.Replace(b, []byte("<!-- local-app-bootstrap -->"), script, 1)
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write(b)
	})
	mux.HandleFunc("GET /map.png", func(w http.ResponseWriter, r *http.Request) {
		b, _ := webAssets.ReadFile("map.png")
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write(b)
	})
	mux.HandleFunc("POST /api/background", func(w http.ResponseWriter, r *http.Request) {
		var setting struct {
			Background string `json:"background"`
		}
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024))
		if err := decoder.Decode(&setting); err != nil {
			problem(w, 400, err)
			return
		}
		if err := decoder.Decode(new(any)); err != io.EOF || !validBackground(setting.Background) {
			problem(w, 400, fmt.Errorf("background must be dotted-grid, none, or backdrop"))
			return
		}
		s.mu.Lock()
		defer s.mu.Unlock()
		c := s.config
		c.Background = setting.Background
		if err := writeConfig(s.dataDir, c); err != nil {
			problem(w, 500, err)
			return
		}
		s.config = c
		sendJSON(w, 200, map[string]string{"background": c.Background})
	})
	assets, _ := fs.Sub(webAssets, "assets")
	mux.Handle("GET /assets/", http.StripPrefix("/assets/", http.FileServer(http.FS(assets))))
	mux.HandleFunc("POST /api/welcome", func(w http.ResponseWriter, r *http.Request) {
		s.mu.Lock()
		defer s.mu.Unlock()
		c := s.config
		c.WelcomeSeen = true
		if err := writeConfig(s.dataDir, c); err != nil {
			problem(w, 500, err)
			return
		}
		s.config = c
		sendJSON(w, 200, map[string]bool{"ok": true})
	})
	mux.HandleFunc("GET /api/projects", func(w http.ResponseWriter, r *http.Request) {
		s.mu.Lock()
		defer s.mu.Unlock()
		list, err := s.entries()
		if err != nil {
			problem(w, 500, err)
			return
		}
		sendJSON(w, 200, list)
	})
	mux.HandleFunc("POST /api/projects", func(w http.ResponseWriter, r *http.Request) {
		d, ok := s.decode(w, r)
		if !ok {
			return
		}
		title, _ := validateDocument(&d)
		s.mu.Lock()
		defer s.mu.Unlock()
		base := slug(title)
		file := base + ".json"
		for i := 2; ; i++ {
			_, err := os.Lstat(filepath.Join(s.projectsDir, file))
			if os.IsNotExist(err) {
				break
			}
			if err != nil {
				problem(w, 500, err)
				return
			}
			file = fmt.Sprintf("%s-%d.json", base, i)
		}
		b, err := json.MarshalIndent(d, "", "  ")
		if err == nil {
			b = append(b, '\n')
			err = atomicWrite(filepath.Join(s.projectsDir, file), b)
		}
		if err != nil {
			problem(w, 500, err)
			return
		}
		response := projectResponse{File: file, Revision: revision(b), Document: d}
		if err := s.remember(file); err != nil {
			response.Warning = "Project saved, but last-project setting could not be saved: " + err.Error()
		}
		sendJSON(w, 201, response)
	})
	mux.HandleFunc("GET /api/projects/{file}", func(w http.ResponseWriter, r *http.Request) {
		s.mu.Lock()
		defer s.mu.Unlock()
		file := r.PathValue("file")
		d, rev, err := s.readProject(file)
		if err != nil {
			status := 400
			if errors.Is(err, os.ErrNotExist) {
				status = 404
			}
			problem(w, status, err)
			return
		}
		response := projectResponse{File: file, Revision: rev, Document: d}
		if r.URL.Query().Get("open") == "1" {
			if err := s.remember(file); err != nil {
				response.Warning = "Opened project, but last-project setting could not be saved: " + err.Error()
			}
		}
		sendJSON(w, 200, response)
	})
	mux.HandleFunc("PUT /api/projects/{file}", func(w http.ResponseWriter, r *http.Request) {
		d, ok := s.decode(w, r)
		if !ok {
			return
		}
		s.mu.Lock()
		defer s.mu.Unlock()
		file := r.PathValue("file")
		_, rev, err := s.readProject(file)
		if err != nil {
			problem(w, 400, err)
			return
		}
		if r.Header.Get("If-Match") != rev {
			problem(w, 409, fmt.Errorf("Project changed on disk. Export your edits, then reopen the file before saving again."))
			return
		}
		b, err := json.MarshalIndent(d, "", "  ")
		if err == nil {
			b = append(b, '\n')
			err = atomicWrite(filepath.Join(s.projectsDir, file), b)
		}
		if err != nil {
			problem(w, 500, err)
			return
		}
		sendJSON(w, 200, projectResponse{File: file, Revision: revision(b), Document: d})
	})
	mux.HandleFunc("DELETE /api/projects/{file}", func(w http.ResponseWriter, r *http.Request) {
		s.mu.Lock()
		defer s.mu.Unlock()
		file := r.PathValue("file")
		_, rev, err := s.readProject(file)
		if err != nil {
			problem(w, 400, err)
			return
		}
		if r.Header.Get("If-Match") != rev {
			problem(w, 409, fmt.Errorf("Project changed on disk. Refresh the project list before deleting."))
			return
		}
		if s.config.LastProject == file {
			if err := s.remember(""); err != nil {
				problem(w, 500, err)
				return
			}
		}
		if err := os.Remove(filepath.Join(s.projectsDir, file)); err != nil {
			problem(w, 500, err)
			return
		}
		sendJSON(w, 200, map[string]bool{"ok": true})
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		host := r.Host
		if h, _, err := net.SplitHostPort(host); err == nil {
			host = h
		}
		if host != "localhost" && host != "127.0.0.1" && host != "::1" {
			problem(w, 403, fmt.Errorf("local access only"))
			return
		}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		if strings.HasPrefix(r.URL.Path, "/api/") {
			w.Header().Set("Cache-Control", "no-store")
			if r.Header.Get("X-Odysseus-Token") != s.token {
				problem(w, 403, fmt.Errorf("invalid local application session"))
				return
			}
		}
		mux.ServeHTTP(w, r)
	})
}
