/* Local-file adapter. The accepted questApp graph/editor remains authoritative. */
(() => {
  const prototype = window.questApp;
  window.questApp = function () {
    const app = prototype();
    Object.assign(app, { localMode: false, welcome: false, projectLibrary: false, projectFiles: [], currentFile: null, saveState: '', diskError: '', dataFolder: '' });
    const boot = window.odysseyBootstrap;
    if (!boot || window.self !== window.top) return app;
    const original = { init: app.init, persist: app.persist, saveForm: app.saveForm, newProject: app.newProject, undoKey: app.undoKey };
    let backgroundQueue = Promise.resolve();
    let queue = Promise.resolve(), pending = 0, savingNewProject = false;
    let document = { file: boot.current?.file || null, revision: boot.current?.revision || '', failed: false };

    Object.assign(app, {
      localMode: true, background: boot.background || 'dotted-grid', welcome: boot.welcome, projectFiles: boot.projects, dataFolder: boot.dataDir || '',
      async api(path, options = {}) {
        const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10_000);
        try {
          const response = await fetch('/api/' + path, { ...options, signal: controller.signal, headers: { 'Content-Type': 'application/json', 'X-Odysseus-Token': boot.token, ...options.headers } });
          const value = await response.json(); if (!response.ok) throw Error(value.error || 'File operation failed'); return value;
        } finally { clearTimeout(timer); }
      },
      init() {
        if (boot.current) { const saved = boot.current.document; this.project = saved.project; this.nodes = saved.nodes; this.seq = saved.seq; }
        this.currentFile = document.file; this.memoryOnly = true; original.init.call(this); this.memoryOnly = false;
        if (boot.warning) this.notify(boot.warning);
        window.addEventListener('beforeunload', (event) => { if (pending || this.diskError || this.modal) { event.preventDefault(); event.returnValue = ''; } });
      },
      setBackground(value) {
        if (!['dotted-grid', 'none', 'backdrop'].includes(value)) return;
        this.background = value;
        backgroundQueue = backgroundQueue.then(() => this.api('background', { method: 'POST', body: JSON.stringify({ background: value }) }))
          .catch((error) => this.notify('Background changed for this session; preference could not be saved: ' + error.message));
      },
      queueSave(snapshot) {
        const target = document;
        if (target.failed) { this.saveState = 'Unsaved changes'; return; }
        pending++; this.saveState = 'Saving…';
        queue = queue.then(async () => {
          if (target.failed) return;
          try {
            const value = await this.api(target.file ? 'projects/' + encodeURIComponent(target.file) : 'projects', {
              method: target.file ? 'PUT' : 'POST', headers: target.file ? { 'If-Match': target.revision } : {}, body: snapshot
            });
            target.file = value.file; target.revision = value.revision;
            if (target === document) { this.currentFile = value.file; this.diskError = ''; this.saveState = pending > 1 ? 'Saving…' : 'Saved to file'; }
            if (value.warning) this.notify(value.warning);
            await this.refreshProjects();
          } catch (error) {
            target.failed = true;
            if (target === document) { this.diskError = error.message; this.saveState = 'Unsaved changes'; }
          }
        }).finally(() => { pending--; });
      },
      persist(message = 'Questline updated', track = true) {
        if (savingNewProject) { document = { file: null, revision: '', failed: false }; this.currentFile = null; this.undoStack = []; track = false; this.diskError = ''; }
        // A first project has no valid project state to restore with card Undo.
        if (!JSON.parse(this.lastSnapshot).project) track = false;
        this.memoryOnly = true;
        try { original.persist.call(this, message, track); } finally { this.memoryOnly = false; }
        this.queueSave(this.snapshot());
      },
      saveForm() {
        savingNewProject = this.kind === 'project';
        try { original.saveForm.call(this); } finally { savingNewProject = false; }
      },
      async flushDisk() { await queue; return !this.diskError; },
      async retryDiskSave() { document.failed = false; this.diskError = ''; this.queueSave(this.snapshot()); await queue; },
      async refreshProjects() { try { this.projectFiles = await this.api('projects'); } catch (error) { this.notify('Cannot refresh project list: ' + error.message); } },
      canLeaveEditor() { if (this.modal) { this.notify('Save or cancel the open editor first.'); return false; } return true; },
      async newProject() {
        if (!this.canLeaveEditor()) return;
        if (!await this.flushDisk()) { this.notify('Save or export your unsaved changes before starting another project.'); return; }
        this.projectLibrary = false; original.newProject.call(this);
      },
      requestNewProject() { this.newProject(); },
      async openProjects() { if (!this.canLeaveEditor()) return; await this.refreshProjects(); this.projectLibrary = true; },
      async openDiskProject(file, reload = false) {
        if (!this.canLeaveEditor()) return;
        if (reload) { if (!window.confirm('Reopen the saved file and discard unsaved in-memory changes? Export first if you need a copy.')) return; await queue; }
        else if (!await this.flushDisk()) { this.notify('Save or export your unsaved changes before switching projects.'); return; }
        try {
          const value = await this.api('projects/' + encodeURIComponent(file) + '?open=1');
          document = { file: value.file, revision: value.revision, failed: false };
          this.project = value.document.project; this.nodes = value.document.nodes; this.seq = value.document.seq;
          this.currentFile = value.file; this.undoStack = []; this.expandedCards = {}; this.hoveredId = null; this.pendingFocus = null;
          this.ensureContacts(); this.lastSnapshot = this.snapshot(); this.diskError = ''; this.saveState = 'Saved to file'; this.projectLibrary = false;
          this.$nextTick(() => requestAnimationFrame(() => this.renderTree()));
          if (value.warning) this.notify(value.warning);
        } catch (error) { this.notify('Cannot open project: ' + error.message); }
      },
      async deleteDiskProject(file) {
        if (!this.canLeaveEditor() || !await this.flushDisk()) return;
        if (!window.confirm('Delete ' + file + ' from disk? This deletes the entire project file and cannot be undone.')) return;
        try {
          const value = await this.api('projects/' + encodeURIComponent(file));
          await this.api('projects/' + encodeURIComponent(file), { method: 'DELETE', headers: { 'If-Match': value.revision } });
          if (document.file === file) {
            document = { file: null, revision: '', failed: false }; this.currentFile = null; this.project = null; this.nodes = {}; this.seq = 0;
            this.undoStack = []; this.lastSnapshot = this.snapshot(); this.saveState = ''; this.expandedCards = {};
          }
          await this.refreshProjects(); this.notify('Project file deleted');
        } catch (error) { this.notify('Cannot delete project: ' + error.message); }
      },
      async finishWelcome() {
        try { await this.api('welcome', { method: 'POST' }); }
        catch (error) { this.notify('Welcome setting could not be saved; the guide may reappear: ' + error.message); }
        this.welcome = false; if (!this.project) this.newProject();
      },
      undoKey(event) { if (!this.welcome && !this.projectLibrary) original.undoKey.call(this, event); }
    });
    return app;
  };
})();
