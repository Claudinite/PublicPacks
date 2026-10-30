package checks

import (
	"testing"

	"claudinite.com/checksdk"
)

func feature(classes ...string) []checksdk.Turn {
	return []checksdk.Turn{{Index: 1, Timestamp: "2026-10-01T10:00:00Z", Text: "add it", Classes: classes}}
}

func commit(sha, date, subject string, files ...string) checksdk.Commit {
	return checksdk.Commit{Sha: sha, Date: date, Subject: subject, Files: files}
}

func TestFeatureRequirementsFirst(t *testing.T) {
	spec := map[string]string{"dev/requirements/requirements.md": "# spec\n"}
	after, before := "2026-10-01T11:00:00Z", "2026-10-01T09:00:00Z"
	cases := []struct {
		name    string
		turns   []checksdk.Turn
		commits []checksdk.Commit
		files   map[string]string
		cfg     map[string]any
		want    string
	}{
		{"code with no prior spec commit", feature("feature"), []checksdk.Commit{commit("abcdef1234", after, "code", "src/a.js")}, spec, nil, "(branch)"},
		{"an independent spec commit first", feature("feature"), []checksdk.Commit{commit("a1", after, "spec", "dev/requirements/requirements.md"), commit("a2", after, "code", "src/a.js")}, spec, nil, ""},
		{"a mixed spec and code commit", feature("feature"), []checksdk.Commit{commit("a1", after, "both", "dev/requirements/requirements.md", "src/a.js")}, spec, nil, "(branch)"},
		{"code before the feature comment", feature("feature"), []checksdk.Commit{commit("a1", before, "old", "src/a.js")}, spec, nil, ""},
		{"a comment not classified feature", feature("correction"), []checksdk.Commit{commit("a1", after, "code", "src/a.js")}, spec, nil, ""},
		{"no transcript", nil, []checksdk.Commit{commit("a1", after, "code", "src/a.js")}, spec, nil, ""},
		{"no spec in the repo", feature("feature"), []checksdk.Commit{commit("a1", after, "code", "src/a.js")}, map[string]string{"x": ""}, nil, ""},
		{"a configured spec, doc first", feature("feature"), []checksdk.Commit{commit("a1", after, "spec", "docs/SPEC.md"), commit("a2", after, "code", "src/a.js")}, map[string]string{"docs/SPEC.md": "x"}, map[string]any{"executable-requirements": map[string]any{"spec": "docs/SPEC.md"}}, ""},
		{"a configured spec, code first", feature("feature"), []checksdk.Commit{commit("a1", after, "code", "src/a.js"), commit("a2", after, "spec", "docs/SPEC.md")}, map[string]string{"docs/SPEC.md": "x"}, map[string]any{"executable-requirements": map[string]any{"spec": "docs/SPEC.md"}}, "(branch)"},
	}
	for _, c := range cases {
		expect(t, c.name, run(t, featureRequirementsFirst, c.files, &checksdk.Fake{Turns: c.turns, Commits: c.commits, PackConfig: c.cfg}), c.want)
	}
	fs := run(t, featureRequirementsFirst, spec, &checksdk.Fake{Turns: feature("feature"), Commits: []checksdk.Commit{commit("abcdef1234", after, "code", "README.md", "src/a.js")}})
	if len(fs) != 1 || fs[0].Sentence != `commit abcdef1 ("code") changes code (src/a.js) before any independent commit updating dev/requirements/requirements.md` {
		t.Errorf("%+v", fs)
	}
}

// The feature turn judges only a branch its work went to: one the
// transcript recorded while it ran, or any branch where it recorded none.
// What the adoption writes and a local pack carries under .claudinite/ is
// not the product's code.
func TestFeatureRequirementsFirstScope(t *testing.T) {
	spec := map[string]string{"dev/requirements/requirements.md": "# spec\n"}
	after := "2026-10-01T11:00:00Z"
	on := func(branches ...string) []checksdk.Turn {
		ts := feature("feature")
		ts[0].Branches = branches
		return ts
	}
	code := []checksdk.Commit{commit("a1", after, "code", "src/a.js")}
	cases := []struct {
		name    string
		turns   []checksdk.Turn
		branch  string
		commits []checksdk.Commit
		want    string
	}{
		{"the branch the feature turn ran on", on("main", "acme-feature"), "acme-feature", code, "(branch)"},
		{"a later branch of the same session", on("main", "acme-feature"), "acme-lesson", code, ""},
		{"a transcript that recorded no branch", on(), "acme-lesson", code, "(branch)"},
		{"only adoption output and a local pack's check", on(), "acme-feature", []checksdk.Commit{commit("a1", after, "adopt", ".claudinite/cache/claudinite-rules.GENERATED.md", ".claudinite/shared/packs/acme-pack/pack.json", ".claudinite/local/packs/acme-pack/checks/acme_check.go")}, ""},
		{"code beside a .claudinite file", on(), "acme-feature", []checksdk.Commit{commit("a1", after, "code", ".claudinite/settings.yaml", "src/a.js")}, "(branch)"},
	}
	for _, c := range cases {
		expect(t, c.name, run(t, featureRequirementsFirst, spec, &checksdk.Fake{Turns: c.turns, Branch: c.branch, Commits: c.commits}), c.want)
	}
}
