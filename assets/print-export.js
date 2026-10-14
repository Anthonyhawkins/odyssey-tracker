/* Read-only print snapshot: reuse the accepted renderer in its own window. */
(() => {
  const css = `
    html,body{margin:0;background:white;color:#17243b;font-family:Arial,Helvetica,sans-serif}
    *{box-sizing:border-box} .print-toolbar{position:sticky;top:0;left:0;width:100vw;z-index:100;background:#eff6ff;border-bottom:1px solid #bfdbfe;padding:14px 20px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:14px}
    .print-toolbar p{margin:0;max-width:760px}.print-toolbar button{border:1px solid #93c5fd;border-radius:8px;padding:9px 14px;background:white;color:#1d4ed8;font-weight:700}.print-toolbar button:disabled{opacity:.5}
    .map-sheet{padding:24px;background:white;break-after:page}.print-heading h1{font-size:28px;margin:0 0 10px;line-height:1.3;overflow-wrap:anywhere}.print-heading p{font-size:15px;margin:8px 0;max-width:1000px;white-space:pre-wrap;overflow-wrap:anywhere}.print-meta{color:#64748b;font-size:13px!important}
    .print-viewport{width:1060px}.graph-space{position:relative;overflow:visible!important}.tree-canvas{position:relative!important;transform:none!important;margin:0!important;padding:0!important;min-width:0!important}
    .quest-card,.quest-position{transition:none!important}.card-title-button span{display:block!important;-webkit-line-clamp:unset!important;overflow:visible!important}.card-title-button,.card-description,.card-meta-row span,.card-path-context,.card-link span,.card-tag{overflow:visible!important;text-overflow:clip!important;max-width:none!important;white-space:normal!important;overflow-wrap:anywhere}
    .card-meta-row{height:auto!important;gap:8px;align-items:flex-start}.card-meta-row span{flex:1}.card-secondary-details{display:block!important}.card-tags{flex-wrap:wrap}.card-link{align-items:flex-start;flex-wrap:wrap}.card-link .printed-url{display:block;font-size:10px;color:#64748b;width:100%;overflow-wrap:anywhere}
    .card-timestamps{line-height:1.6}.print-card-reference{font-size:10px;color:#64748b;margin-top:6px}.parallel-group-scroll{overflow:visible!important}.parallel-grid{overflow:visible!important}
    .quest-actions,.group-header-actions,.parallel-group-tools,.group-endpoint,.group-endpoint-actions,.card-details-toggle,.node-parallel-add,.abandoned-card-note button{display:none!important}.parallel-group-header>div:first-child{max-width:none}.parallel-group-header{height:auto!important;min-height:64px;overflow-wrap:anywhere}
    #questTree{pointer-events:none}.graph-dimmed{opacity:1!important}.quest-card button{cursor:default}
    .appendix{max-width:900px;padding:32px;margin:0 auto;overflow-wrap:anywhere}.appendix h2{font-size:24px;margin:0 0 16px}.appendix h3{font-size:19px;margin:24px 0 12px;break-after:avoid}.appendix h4{font-size:15px;margin:15px 0 8px;break-after:avoid}.appendix p,.appendix .plain-text{font-size:14px;line-height:1.6;white-space:pre-wrap;margin:8px 0}.appendix time{font-size:12px;color:#64748b}.appendix .log-entry{break-inside:auto}.appendix .card-appendix{border-top:1px solid #e2e8f0;margin-top:24px;padding-top:8px}.appendix .empty{color:#64748b}
    @page card-notes{size:A4 portrait;margin:16mm}
    @media print{html,body{margin:0!important;padding:0!important;background:white!important}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.print-toolbar{display:none!important}.map-sheet{page:quest-map;padding:0!important}.appendix{page:card-notes;max-width:none!important;width:auto!important;margin:0!important;padding:0!important}.card-appendix:first-of-type{border-top:0}}
  `;

  window.odysseusPrintExport = async function (live) {
    if (!live.project) return;
    if (live.modal) { live.notify('Save or cancel the open editor before exporting PDF.'); return; }
    let popup;
    try { popup = window.open('', '_blank'); }
    catch { live.notify('This browser or preview prevents print windows. Open the app in a standalone tab to export PDF.'); return; }
    if (!popup) { live.notify('Allow pop-ups for this app to open the PDF print view.'); return; }
    const doc = popup.document;
    try {
      const snapshot = JSON.parse(live.snapshot());
      const renderer = [...document.scripts].find(script => script.textContent.includes('function questApp()'));
      if (!renderer) throw Error('The quest-map renderer is unavailable.');
      doc.open();
      doc.write('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Quest map PDF</title></head><body><div class="print-toolbar"><button id="print-report" type="button" disabled>Print / Save as PDF</button><p id="print-status" role="status">Preparing expanded cards…</p></div><section class="map-sheet"><header class="print-heading"></header><div class="print-viewport"><div class="graph-space"><div class="tree-canvas"><div id="questTree"></div></div></div></div></section><section class="appendix"><h2>Card notes and progress logs</h2><p>Card references match the expanded map. Notes and logs are plain text.</p></section></body></html>');
      doc.close();
      doc.title = snapshot.project.title + ' — Quest map';
      // Copy already-loaded styles, including the local Tailwind runtime output.
      for (const original of document.querySelectorAll('style')) { const style = doc.createElement('style'); style.textContent = original.textContent; doc.head.append(style); }
      const style = doc.createElement('style'); style.textContent = css; doc.head.append(style);
      const script = doc.createElement('script'); script.textContent = renderer.textContent; doc.head.append(script);
      const app = popup.questApp();
      Object.assign(app, snapshot, { memoryOnly: true, zoom: 1, hoveredId: null, pendingFocus: null });
      app.$refs = { canvas: doc.querySelector('.print-viewport'), graphSpace: doc.querySelector('.graph-space'), graphContent: doc.querySelector('.tree-canvas') };
      app.$nextTick = () => {}; // No live editing, centering, or persistence callbacks.
      app.ensureContacts();
      for (const node of Object.values(app.nodes)) { node.groupDensity = 'normal'; app.expandedCards[node.id] = true; }
      const groups = app.parallelGroups;
      app.parallelGroups = function (heights) {
        const layout = groups.call(this, heights);
        for (const group of layout.groups.values()) { group.visibleColumns = group.columns; group.width = 2 * group.padding + group.columns * group.cardWidth + (group.columns - 1) * group.gap; }
        return layout;
      };
      const heading = doc.querySelector('.print-heading');
      function text(parent, tag, value, className) { const element = doc.createElement(tag); element.textContent = String(value ?? ''); if (className) element.className = className; parent.append(element); return element; }
      text(heading, 'h1', app.project.title);
      text(heading, 'p', app.project.goal || '');
      text(heading, 'p', 'Exported ' + new Date().toLocaleString() + ' · ' + Object.keys(app.nodes).length + ' cards · All cards expanded', 'print-meta');
      if (doc.fonts?.ready) await doc.fonts.ready;
      app.renderTree();
      // Printed URLs and references are part of card height before the final layout.
      const cardHTML = app.cardHTML;
      app.cardHTML = function (...args) {
        const html = cardHTML.apply(this, args), holder = doc.createElement('div'); holder.innerHTML = html;
        const card = holder.querySelector('[data-card]');
        if (card) {
          text(card, 'div', 'Card ' + args[0], 'print-card-reference');
          for (const link of card.querySelectorAll('a[href]')) text(link, 'span', link.href, 'printed-url');
        }
        return holder.innerHTML;
      };
      app.renderTree();
      // Remove editing controls from the export document, preserving card titles.
      for (const button of doc.querySelectorAll('#questTree button')) {
        if (button.classList.contains('card-title-button')) { const title = doc.createElement('div'); title.className = button.className; title.innerHTML = button.innerHTML; button.replaceWith(title); }
        else button.remove();
      }
      for (const control of doc.querySelectorAll('#questTree select')) control.remove();
      const appendix = doc.querySelector('.appendix');
      for (const node of Object.values(app.nodes)) {
        const notes = String(node.notes || ''), entries = [...(node.log || [])].sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
        if (!notes && !entries.length) continue;
        const section = doc.createElement('article'); section.className = 'card-appendix'; section.dataset.cardReference = node.id; appendix.append(section);
        text(section, 'h3', 'Card ' + node.id + ' — ' + node.title);
        if (notes) { text(section, 'h4', 'Notes'); text(section, 'div', notes, 'plain-text'); }
        if (entries.length) {
          text(section, 'h4', 'Progress log');
          for (const entry of entries) {
            const article = doc.createElement('article'); article.className = 'log-entry'; section.append(article);
            text(article, 'time', app.formatTimestamp(entry.timestamp));
            text(article, 'div', entry.text, 'plain-text');
            if (entry.updatedAt) text(article, 'time', 'Edited ' + app.formatTimestamp(entry.updatedAt));
          }
        }
      }
      if (!appendix.querySelector('.card-appendix')) text(appendix, 'p', 'No notes or progress log entries have been added.', 'empty');
      await new Promise(resolve => popup.requestAnimationFrame(() => popup.requestAnimationFrame(resolve)));
      const map = doc.querySelector('.map-sheet');
      const width = Math.ceil(Math.max(app.graphWidth, heading.scrollWidth) + 48), height = Math.ceil(heading.offsetHeight + app.graphHeight + 64);
      map.style.width = width + 'px'; map.style.height = height + 'px';
      // PDF viewers commonly limit a page to 200 inches. Refuse truncation.
      if (width > 18000 || height > 18000) throw Error('This expanded map is too large for a single browser PDF page. A tiled map export is needed for this project.');
      const pageStyle = doc.createElement('style'); pageStyle.textContent = `@page quest-map{size:${width + 40}px ${height + 40}px;margin:20px}`; doc.head.append(pageStyle);
      const print = doc.getElementById('print-report'), status = doc.getElementById('print-status');
      status.textContent = 'Choose Save as PDF, keep the document’s page sizes, use 100% scale, and turn off browser headers/footers. The map is one large page; notes and logs follow on A4 pages. Canceling keeps this preview open.';
      print.disabled = false;
      print.addEventListener('click', () => { popup.focus(); popup.print(); });
      doc.documentElement.dataset.printReady = 'true';
      popup.opener = null;
      popup.focus();
      popup.print();
    } catch (error) {
      if (!popup.closed) { const status = doc.getElementById('print-status'); if (status) status.textContent = 'PDF export could not be prepared: ' + error.message; doc.documentElement.dataset.printError = 'true'; }
      live.notify('PDF export could not be prepared: ' + error.message);
    }
  };
})();
