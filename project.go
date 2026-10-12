package main

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// Raw JSON preserves unknown content fields and historical values exactly.
type Document struct {
	Project json.RawMessage            `json:"project"`
	Nodes   map[string]json.RawMessage `json:"nodes"`
	Seq     int                        `json:"seq"`
}
type projectFields struct {
	Title    string `json:"title"`
	Root     string `json:"root"`
	Contacts []struct {
		ID string `json:"id"`
	} `json:"contacts"`
	Tags []struct {
		ID string `json:"id"`
	} `json:"tags"`
}
type graphNode struct {
	ID           string   `json:"id"`
	Parent       string   `json:"parent"`
	Children     []string `json:"children"`
	IsParallel   bool     `json:"isParallel"`
	ParallelOf   string   `json:"parallelOf"`
	BlockedBy    string   `json:"blockedBy"`
	MergeAfterID string   `json:"mergeAfterId"`
	MergeOrder   int      `json:"mergeOrder"`
	OwnerIDs     []string `json:"ownerIds"`
	TagIDs       []string `json:"tagIds"`
}

var filePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{0,100}\.json$`)
var idPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{1,128}$`)

func validFilename(s string) bool { return filePattern.MatchString(s) }
func slug(title string) string {
	s := strings.ToLower(strings.TrimSpace(title))
	var b strings.Builder
	dash := false
	for _, c := range s {
		if c >= 'a' && c <= 'z' || c >= '0' && c <= '9' {
			b.WriteRune(c)
			dash = false
		} else if b.Len() > 0 && !dash {
			b.WriteByte('-')
			dash = true
		}
		if b.Len() >= 80 {
			break
		}
	}
	s = strings.Trim(b.String(), "-")
	if s == "" {
		s = "project"
	}
	return s
}

func validateDocument(d *Document) (string, error) {
	if d.Seq < 0 {
		return "", fmt.Errorf("seq cannot be negative")
	}
	var p projectFields
	if err := json.Unmarshal(d.Project, &p); err != nil {
		return "", fmt.Errorf("invalid project: %w", err)
	}
	if strings.TrimSpace(p.Title) == "" || p.Root == "" {
		return "", fmt.Errorf("project needs a title and root")
	}
	if len(d.Nodes) == 0 || len(d.Nodes) > 10000 {
		return "", fmt.Errorf("project must contain 1–10000 cards")
	}
	nodes := make(map[string]graphNode, len(d.Nodes))
	for id, raw := range d.Nodes {
		var n graphNode
		if err := json.Unmarshal(raw, &n); err != nil {
			return "", fmt.Errorf("card %s: %w", id, err)
		}
		if n.ID != id || !idPattern.MatchString(id) {
			return "", fmt.Errorf("card ID does not match key %s", id)
		}
		nodes[id] = n
		if v, err := strconv.Atoi(strings.TrimPrefix(id, "n")); err == nil && strings.HasPrefix(id, "n") && v > d.Seq {
			d.Seq = v
		}
		if n.MergeOrder > d.Seq {
			d.Seq = n.MergeOrder
		}
	}
	root, ok := nodes[p.Root]
	if !ok || root.Parent != "" {
		return "", fmt.Errorf("project root is missing or has a parent")
	}
	banks := []map[string]bool{{}, {}}
	for _, contact := range p.Contacts {
		if contact.ID == "" || banks[0][contact.ID] {
			return "", fmt.Errorf("invalid contact IDs")
		}
		banks[0][contact.ID] = true
	}
	for _, tag := range p.Tags {
		if tag.ID == "" || banks[1][tag.ID] {
			return "", fmt.Errorf("invalid tag IDs")
		}
		banks[1][tag.ID] = true
	}
	for id, n := range nodes {
		if id != p.Root && n.Parent == "" {
			return "", fmt.Errorf("card %s is disconnected", id)
		}
		if n.Parent != "" {
			parent, ok := nodes[n.Parent]
			if !ok {
				return "", fmt.Errorf("card %s has a missing parent", id)
			}
			found := false
			for _, child := range parent.Children {
				if child == id {
					found = true
				}
			}
			if !found {
				return "", fmt.Errorf("card %s has no reciprocal parent link", id)
			}
		}
		seen := map[string]bool{}
		for _, child := range n.Children {
			other, ok := nodes[child]
			if !ok || other.Parent != id || seen[child] {
				return "", fmt.Errorf("card %s has invalid children", id)
			}
			seen[child] = true
		}
		for _, ref := range []string{n.ParallelOf, n.BlockedBy, n.MergeAfterID} {
			if ref != "" {
				if _, ok := nodes[ref]; !ok {
					return "", fmt.Errorf("card %s has missing reference %s", id, ref)
				}
			}
		}
		if n.IsParallel && n.ParallelOf == "" {
			return "", fmt.Errorf("card %s needs a parallel anchor", id)
		}
		for i, ids := range [][]string{n.OwnerIDs, n.TagIDs} {
			for _, ref := range ids {
				if !banks[i][ref] {
					return "", fmt.Errorf("card %s has an invalid bank assignment", id)
				}
			}
		}
	}
	active, done := map[string]bool{}, map[string]bool{}
	var visit func(string) error
	visit = func(id string) error {
		if active[id] {
			return fmt.Errorf("structural cycle at %s", id)
		}
		if done[id] {
			return nil
		}
		active[id] = true
		for _, ref := range []string{nodes[id].Parent, nodes[id].ParallelOf} {
			if ref != "" {
				if err := visit(ref); err != nil {
					return err
				}
			}
		}
		delete(active, id)
		done[id] = true
		return nil
	}
	for id := range nodes {
		if err := visit(id); err != nil {
			return "", err
		}
	}
	if d.Seq < 0 {
		return "", fmt.Errorf("seq cannot be negative")
	}
	return p.Title, nil
}
