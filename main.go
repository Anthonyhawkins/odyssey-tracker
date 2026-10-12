package main

import (
	"context"
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"
)

func run() error {
	defaultDir, err := os.UserConfigDir()
	if err != nil {
		return err
	}
	dir := flag.String("data-dir", filepath.Join(defaultDir, "odysseus-tracker"), "folder containing config.yaml and projects")
	listen := flag.String("listen", "", "override config listen address (loopback only)")
	flag.Parse()
	s, err := newAppServer(*dir)
	if err != nil {
		return err
	}
	addr := s.config.Listen
	if *listen != "" {
		addr = *listen
	}
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return err
	}
	if host != "localhost" && (net.ParseIP(host) == nil || !net.ParseIP(host).IsLoopback()) {
		return fmt.Errorf("listen address must be loopback")
	}
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		return err
	}
	server := &http.Server{Handler: s.handler(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 30 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdown)
	}()
	fmt.Printf("Odysseus Tracker\nOpen http://%s in your browser\nData: %s\nPress Ctrl+C to stop.\n", listener.Addr(), *dir)
	err = server.Serve(listener)
	if err == http.ErrServerClosed {
		return nil
	}
	return err
}
func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "Odysseus Tracker:", err)
		os.Exit(1)
	}
}
