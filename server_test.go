package main

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

func testServer(t *testing.T) *appServer {
	t.Helper()
	s, err := newAppServer(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	return s
}
func fixtureDocument(t *testing.T, name string) []byte {
	t.Helper()
	b, err := os.ReadFile(filepath.Join("tests", "fixtures", name))
	if err != nil {
		t.Fatal(err)
	}
	return b
}
func request(s *appServer, method, path string, b []byte, rev string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, "http://127.0.0.1:8042"+path, bytes.NewReader(b))
	r.Header.Set("X-Odysseus-Token", s.token)
	r.Header.Set("If-Match", rev)
	w := httptest.NewRecorder()
	s.handler().ServeHTTP(w, r)
	return w
}
func decodeResponse(t *testing.T, w *httptest.ResponseRecorder, code int) projectResponse {
	t.Helper()
	if w.Code != code {
		t.Fatalf("status %d: %s", w.Code, w.Body)
	}
	var p projectResponse
	if err := json.Unmarshal(w.Body.Bytes(), &p); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestFirstRunAndConfigPersistence(t *testing.T) {
	s := testServer(t)
	if s.bootstrap()["welcome"] != true {
		t.Fatal("first run must welcome")
	}
	if w := request(s, "POST", "/api/welcome", nil, ""); w.Code != 200 {
		t.Fatal(w.Body)
	}
	restarted, err := newAppServer(s.dataDir)
	if err != nil {
		t.Fatal(err)
	}
	if restarted.bootstrap()["welcome"] != false {
		t.Fatal("welcome acknowledgement not persisted")
	}
	config, err := os.ReadFile(filepath.Join(s.dataDir, "config.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Contains(config, []byte("projects_dir: projects")) {
		t.Fatal("missing configurable project folder")
	}
}
func TestProjectCRUDAndLastProject(t *testing.T) {
	s := testServer(t)
	original := fixtureDocument(t, "baseline-v1.json")
	first := decodeResponse(t, request(s, "POST", "/api/projects", original, ""), 201)
	second := decodeResponse(t, request(s, "POST", "/api/projects", original, ""), 201)
	if first.File == second.File {
		t.Fatal("same-title projects overwritten")
	}
	loaded := decodeResponse(t, request(s, "GET", "/api/projects/"+first.File+"?open=1", nil, ""), 200)
	if loaded.Revision != first.Revision {
		t.Fatal("read changed project bytes")
	}
	restarted, err := newAppServer(s.dataDir)
	if err != nil {
		t.Fatal(err)
	}
	if restarted.config.LastProject != first.File {
		t.Fatal("last project not remembered")
	}
	var d Document
	_ = json.Unmarshal(original, &d)
	var n map[string]any
	_ = json.Unmarshal(d.Nodes["n19"], &n)
	n["notes"] = "Changed notes"
	n["futureField"] = map[string]any{"preserve": true}
	d.Nodes["n19"], _ = json.Marshal(n)
	updated, _ := json.Marshal(d)
	saved := decodeResponse(t, request(s, "PUT", "/api/projects/"+first.File, updated, first.Revision), 200)
	if saved.Revision == first.Revision {
		t.Fatal("update did not change revision")
	}
	var preserved map[string]any
	_ = json.Unmarshal(saved.Document.Nodes["n19"], &preserved)
	if preserved["created"] != n["created"] || preserved["futureField"] == nil {
		t.Fatal("content/history lost")
	}
	if w := request(s, "PUT", "/api/projects/"+first.File, original, first.Revision); w.Code != 409 {
		t.Fatal("stale save must conflict")
	}
	if w := request(s, "DELETE", "/api/projects/"+first.File, nil, first.Revision); w.Code != 409 {
		t.Fatal("stale delete must conflict")
	}
	if w := request(s, "DELETE", "/api/projects/"+first.File, nil, saved.Revision); w.Code != 200 {
		t.Fatal(w.Body)
	}
	if s.config.LastProject != "" {
		t.Fatal("deleted project is still last project")
	}
	if _, err := os.Stat(filepath.Join(s.projectsDir, second.File)); err != nil {
		t.Fatal("other project deleted")
	}
}
func TestInvalidGraphDoesNotOverwriteFile(t *testing.T) {
	s := testServer(t)
	original := fixtureDocument(t, "baseline-v1.json")
	created := decodeResponse(t, request(s, "POST", "/api/projects", original, ""), 201)
	var d Document
	_ = json.Unmarshal(original, &d)
	cases := []struct {
		name   string
		change func(*Document)
	}{
		{"negative sequence", func(d *Document) { d.Seq = -1 }},
		{"unsafe ID", func(d *Document) {
			var n map[string]any
			_ = json.Unmarshal(d.Nodes["n19"], &n)
			n["id"] = "<unsafe>"
			delete(d.Nodes, "n19")
			d.Nodes["<unsafe>"], _ = json.Marshal(n)
		}},
		{"dangling blocker", func(d *Document) {
			var n map[string]any
			_ = json.Unmarshal(d.Nodes["n19"], &n)
			n["blockedBy"] = "missing"
			d.Nodes["n19"], _ = json.Marshal(n)
		}},
		{"cycle", func(d *Document) {
			var n map[string]any
			_ = json.Unmarshal(d.Nodes["n19"], &n)
			n["parallelOf"] = "n19"
			d.Nodes["n19"], _ = json.Marshal(n)
		}},
		{"mismatched ID", func(d *Document) {
			var n map[string]any
			_ = json.Unmarshal(d.Nodes["n19"], &n)
			n["id"] = "other"
			d.Nodes["n19"], _ = json.Marshal(n)
		}},
		{"missing child", func(d *Document) { delete(d.Nodes, "n19") }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var value Document
			_ = json.Unmarshal(original, &value)
			tc.change(&value)
			b, _ := json.Marshal(value)
			if w := request(s, "PUT", "/api/projects/"+created.File, b, created.Revision); w.Code != 400 {
				t.Fatalf("status %d", w.Code)
			}
			_, rev, err := s.readProject(created.File)
			if err != nil || rev != created.Revision {
				t.Fatal("invalid write damaged project")
			}
		})
	}
}
func TestExportWithoutSequenceAndLegacyOwners(t *testing.T) {
	s := testServer(t)
	var saved map[string]json.RawMessage
	_ = json.Unmarshal(fixtureDocument(t, "baseline-v1.json"), &saved)
	delete(saved, "seq")
	b, _ := json.Marshal(saved)
	current := decodeResponse(t, request(s, "POST", "/api/projects", b, ""), 201)
	if current.Document.Seq < 29 {
		t.Fatal("unsafe derived sequence")
	}
	decodeResponse(t, request(s, "POST", "/api/projects", fixtureDocument(t, "legacy-owner.json"), ""), 201)
}
func TestFilesystemAndSessionBoundaries(t *testing.T) {
	s := testServer(t)
	outside := filepath.Join(s.dataDir, "outside.json")
	if err := os.WriteFile(outside, fixtureDocument(t, "baseline-v1.json"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(s.projectsDir, "linked.json")); err == nil {
		if _, _, err := s.readProject("linked.json"); err == nil {
			t.Fatal("followed project symlink")
		}
	}
	for _, name := range []string{"../outside.json", "/absolute.json", "config.yaml", "sub/file.json"} {
		if _, _, err := s.readProject(name); err == nil {
			t.Fatalf("accepted %s", name)
		}
	}
	r := httptest.NewRequest("POST", "http://127.0.0.1:8042/api/projects", bytes.NewReader(fixtureDocument(t, "baseline-v1.json")))
	w := httptest.NewRecorder()
	s.handler().ServeHTTP(w, r)
	if w.Code != 403 {
		t.Fatal("missing session token accepted")
	}
	r = httptest.NewRequest("GET", "http://evil.example/", nil)
	w = httptest.NewRecorder()
	s.handler().ServeHTTP(w, r)
	if w.Code != 403 {
		t.Fatal("foreign hostname accepted")
	}
	if w := request(s, "GET", "/assets/tailwind.js", nil, ""); w.Code != 200 || !bytes.Contains(w.Body.Bytes(), []byte("tailwind")) {
		t.Fatal("embedded styles missing")
	}
	if w := request(s, "GET", "/", nil, ""); w.Code != 200 || !bytes.Contains(w.Body.Bytes(), []byte("window.odysseyBootstrap=")) || bytes.Contains(w.Body.Bytes(), []byte("https://cdn.tailwindcss.com")) {
		t.Fatal("offline page missing")
	}
}
func TestConcurrentRevisionWrites(t *testing.T) {
	s := testServer(t)
	b := fixtureDocument(t, "baseline-v1.json")
	p := decodeResponse(t, request(s, "POST", "/api/projects", b, ""), 201)
	var d Document
	_ = json.Unmarshal(b, &d)
	d.Seq++
	changed, _ := json.Marshal(d)
	statuses := make(chan int, 2)
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			statuses <- request(s, "PUT", "/api/projects/"+p.File, changed, p.Revision).Code
		}()
	}
	wg.Wait()
	close(statuses)
	counts := map[int]int{}
	for status := range statuses {
		counts[status]++
	}
	if counts[200] != 1 || counts[409] != 1 {
		t.Fatalf("lost update: %v", counts)
	}
}
func TestBadConfigAndFailedReplacementKeepBytes(t *testing.T) {
	dir := t.TempDir()
	name := filepath.Join(dir, "config.yaml")
	bad := "listen: 0.0.0.0:8042\nprojects_dir: projects\n"
	_ = os.WriteFile(name, []byte(bad), 0600)
	if _, err := loadConfig(dir); err == nil {
		t.Fatal("public bind accepted")
	}
	b, _ := os.ReadFile(name)
	if string(b) != bad {
		t.Fatal("bad config silently replaced")
	}
	target := filepath.Join(dir, "existing.json")
	_ = os.Mkdir(target, 0700)
	sentinel := filepath.Join(target, "keep")
	_ = os.WriteFile(sentinel, []byte("keep"), 0600)
	if err := atomicWrite(target, []byte("replace")); err == nil {
		t.Fatal("unexpected replacement")
	}
	b, _ = os.ReadFile(sentinel)
	if strings.TrimSpace(string(b)) != "keep" {
		t.Fatal("failed write damaged destination")
	}
}

func TestUserTextCannotEndBootstrapScript(t *testing.T) {
	s := testServer(t)
	var d Document
	_ = json.Unmarshal(fixtureDocument(t, "baseline-v1.json"), &d)
	var p map[string]any
	_ = json.Unmarshal(d.Project, &p)
	p["title"] = "</script><script>alert(1)</script>"
	d.Project, _ = json.Marshal(p)
	b, _ := json.Marshal(d)
	decodeResponse(t, request(s, "POST", "/api/projects", b, ""), 201)
	page := request(s, "GET", "/", nil, "")
	if bytes.Contains(page.Body.Bytes(), []byte("</script><script>alert(1)</script>")) || !bytes.Contains(page.Body.Bytes(), []byte(`\u003c/script\u003e`)) {
		t.Fatal("bootstrap contains unescaped user markup")
	}
}
