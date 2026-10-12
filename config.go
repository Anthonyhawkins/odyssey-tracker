package main

import (
	"bytes"
	"fmt"
	"net"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Listen      string `yaml:"listen" json:"listen"`
	ProjectsDir string `yaml:"projects_dir" json:"projectsDir"`
	LastProject string `yaml:"last_project" json:"lastProject"`
	WelcomeSeen bool   `yaml:"welcome_seen" json:"welcomeSeen"`
}

func loadConfig(dir string) (Config, error) {
	c := Config{Listen: "127.0.0.1:8042", ProjectsDir: "projects"}
	b, err := os.ReadFile(filepath.Join(dir, "config.yaml"))
	if os.IsNotExist(err) {
		return c, writeConfig(dir, c)
	}
	if err != nil {
		return c, err
	}
	dec := yaml.NewDecoder(bytes.NewReader(b))
	dec.KnownFields(true)
	if err := dec.Decode(&c); err != nil {
		return c, fmt.Errorf("config.yaml: %w", err)
	}
	host, _, err := net.SplitHostPort(c.Listen)
	if err != nil || (host != "localhost" && (net.ParseIP(host) == nil || !net.ParseIP(host).IsLoopback())) {
		return c, fmt.Errorf("listen must be a loopback address, such as 127.0.0.1:8042")
	}
	if c.ProjectsDir == "" {
		return c, fmt.Errorf("projects_dir cannot be empty")
	}
	if c.LastProject != "" && !validFilename(c.LastProject) {
		return c, fmt.Errorf("last_project must be a project JSON filename")
	}
	return c, nil
}

func writeConfig(dir string, c Config) error {
	b, err := yaml.Marshal(c)
	if err != nil {
		return err
	}
	return atomicWrite(filepath.Join(dir, "config.yaml"), b)
}

// Write the replacement in the destination directory and flush it before rename.
// Existing project bytes survive every failure before the final atomic rename.
func atomicWrite(name string, b []byte) error {
	f, err := os.CreateTemp(filepath.Dir(name), ".odysseus-*")
	if err != nil {
		return err
	}
	temp := f.Name()
	defer os.Remove(temp)
	if err = f.Chmod(0600); err == nil {
		_, err = f.Write(b)
	}
	if err == nil {
		err = f.Sync()
	}
	closeErr := f.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	if err := os.Rename(temp, name); err != nil {
		return err
	}
	// Some platforms cannot sync directories; file flush and rename still apply.
	if d, err := os.Open(filepath.Dir(name)); err == nil {
		_ = d.Sync()
		_ = d.Close()
	}
	return nil
}
