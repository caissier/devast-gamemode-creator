let eventTypes = [];
let commandTypes = [];
let events = [];
let tempCmds = [];
let tab = "eventType"; // default tab
let isDisabledAtStart = false;

function fetchData(file) {
  return fetch(file).then(r => r.json());
}

function showTabs() {
  const nav = document.querySelector('nav');
  nav.innerHTML = `
    <button id="eventTypeTab" class="tab${tab === 'eventType' ? ' active' : ''}">EventType Tools</button>
    <button id="documentationTab" class="tab${tab === 'documentation' ? ' active' : ''}">Documentation</button>
    <button id="linksTab" class="tab${tab === 'links' ? ' active' : ''}">Links</button>
  `;
  document.getElementById("eventTypeTab").onclick = () => switchTab("eventType");
  document.getElementById("documentationTab").onclick = () => switchTab("documentation");
  document.getElementById("linksTab").onclick = () => switchTab("links");
}

function switchTab(t) {
  tab = t;
  showTabs();
  if (t === 'eventType') showEventTypeTools();
  else if (t === 'documentation') showDocumentationTab();
  else if (t === 'links') showLinksTab();
}

async function showEventTypeTools() {
  showTabs();
  eventTypes = await fetchData('event_types.json');
  commandTypes = await fetchData('commands.json');

  const body = document.getElementById('tabContainer');
  body.innerHTML = `
    <div class="event-form">
      <h2 class="doc-title">EventType Tools</h2>
      <div class="form-row">
        <label for="eventTypeSel" style="font-size:1.35em;color:#b60202;">Event Type</label>
        <select id="eventTypeSel"></select>
      </div>
      <div id="paramFields"></div>
      <div class="form-row">
        <button type="button" id="disabledBtn" class="toggle-btn">Disabled at start</button>
      </div>
      <div class="form-row">
        <label for="idString">Event ID (optional)</label>
        <input id="idString" placeholder="Any string" />
      </div>
      <div class="cmd-form">
        <h3>Add Command to Event</h3>
        <div class="form-row">
          <label for="cmdTypeSel" style="font-size:1.35em;color:#b60202;">Command</label>
          <select id="cmdTypeSel"></select>
        </div>
        <div id="cmdFields"></div>
        <button id="addCmdBtn" type="button">Add Command</button>
        <div id="cmdsPreview"></div>
      </div>
      <button id="addEventBtn">Add Event</button>
    </div>
    <div class="event-list">
      <h2>Events List</h2>
      <div id="eventsList"></div>
    </div>
    <div class="editor-controls">
      <button id="exportBtn">Export JSON</button>
      <button id="importBtn">Import JSON</button>
      <input type="file" id="jsonFile" style="display:none" accept=".json,.txt" />
      <textarea id="jsonArea" placeholder="Paste or edit JSON here" style="display:none; height:120px;"></textarea>
      <button id="applyJsonBtn" style="display:none;">Apply JSON</button>
    </div>
  `;

  populateEventTypeSelector();
  document.getElementById('eventTypeSel').addEventListener('change', onEventTypeSelect);
  document.getElementById('addEventBtn').addEventListener('click', addEvent);
  document.getElementById('exportBtn').addEventListener('click', exportJSON);
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('jsonArea').style.display = "";
    document.getElementById('applyJsonBtn').style.display = "";
    document.getElementById('jsonFile').style.display = "";
  });
  document.getElementById('applyJsonBtn').addEventListener('click', applyJSON);
  document.getElementById('jsonFile').addEventListener('change', fileImportJSON);
  populateCmdTypeSelector();
  document.getElementById('cmdTypeSel').addEventListener('change', onCmdTypeSelect);
  document.getElementById('addCmdBtn').addEventListener('click', addCmd);
  tempCmds = [];
  renderCmdList();
  refreshEventList();
  onEventTypeSelect();
  onCmdTypeSelect();

  // Disabled at start toggle button
  const disableBtn = document.getElementById('disabledBtn');
  disableBtn.onclick = function() {
    isDisabledAtStart = !isDisabledAtStart;
    disableBtn.classList.toggle('active', isDisabledAtStart);
    disableBtn.textContent = isDisabledAtStart ? "Disabled at start (active)" : "Disabled at start";
  };

  // Patch for addEvent uses toggle button state
  window.addEvent = function() {
    const type = document.getElementById('eventTypeSel').value;
    const curr = eventTypes.find(ev => ev.name === type);
    const params = {};

    if (type === "HasData") {
      // Read arrays of strings for ids and exclude
      params.ids = readStringListInputs('ids');
      params.exclude = readStringListInputs('exclude');
    } else if (curr) {
      curr.params.forEach(p => {
        if (p === 'ids' || p === 'exclude') return; // handled above
        const val = document.getElementById('param_' + p)?.value;
        if (val !== "" || p !== "nb") params[p] = val;
      });
    }

    const idString = document.getElementById('idString').value;
    const disabled = isDisabledAtStart;
    const cmds = tempCmds.map(c => ({cmd: c.cmd, params: c.params}));
    const evt = { eventType: type, params, cmds };
    if (idString) evt.id = idString;
    if (disabled) evt.disabled = true;
    events.push(evt);
    tempCmds = [];
    renderCmdList();
    refreshEventList();
  };

  // Read list of strings from a container
  function readStringListInputs(name) {
    let res = [];
    const container = document.getElementById(name + 'ListContainer');
    if (!container) return res;
    const inputs = container.querySelectorAll('input.input-string');
    inputs.forEach(input => {
      if (input.value.trim()) res.push(input.value.trim());
    });
    return res;
  }

  // Edit params panel updates, for HasData and command params
  function onEventTypeSelect() {
    const sel = document.getElementById('eventTypeSel').value;
    const fields = document.getElementById('paramFields');
    fields.innerHTML = '';
    const curr = eventTypes.find(ev => ev.name === sel);
    if (!curr) return;

    // Special case HasData with lists of strings
    if (sel === 'HasData') {
      // Create UI for ids & exclude string arrays with add/remove buttons
      ['ids', 'exclude'].forEach(name => {
        fields.innerHTML += `
          <div style="margin-bottom:15px;">
            <label>${name.charAt(0).toUpperCase() + name.slice(1)} (list of strings):</label>
            <div id="${name}ListContainer"></div>
            <button type="button" class="trade-subbtn addStringBtn" data-list-name="${name}">+ Add</button>
          </div>
        `;
      });

      // Add event listeners for add buttons
      document.querySelectorAll('.addStringBtn').forEach(btn => {
        btn.onclick = () => {
          const listName = btn.getAttribute('data-list-name');
          const container = document.getElementById(listName + 'ListContainer');
          const div = document.createElement('div');
          div.className = 'form-row';
          div.innerHTML = `
            <input class="input-string" placeholder="Enter ${listName} string" style="flex:1; margin-right:8px;" />
            <button type="button" class="trade-subbtn removeStringBtn">Remove</button>
          `;
          container.appendChild(div);
          div.querySelector('.removeStringBtn').onclick = () => div.remove();
        };
      });
      return;
    }

    curr.params.forEach(p => {
      fields.innerHTML += `
        <div class="form-row">
          <label for="param_${p}">${p}</label>
          <input id="param_${p}" placeholder="${p}">
        </div>
      `;
    });
  }

function onCmdTypeSelect() {
  const sel = document.getElementById('cmdTypeSel').value;
  const fields = document.getElementById('cmdFields');
  fields.innerHTML = '';

  const curr = commandTypes.find(c => c.cmd === sel);
  if (!curr) return;

  if (sel === 'add-data') {
    // For add-data show ids as string list editable
    curr.params.forEach(p => {
      if (p === 'ids') {
        fields.innerHTML += `
          <div style="margin-bottom:15px;">
            <label>Ids (list of strings):</label>
            <div id="addDataIdsContainer"></div>
            <button type="button" class="trade-subbtn addStringBtn" data-list-name="addDataIds">+ Add Id</button>
          </div>
          <div class="form-row">
            <label for="cmdparam_random">random</label>
            <button type="button" class="toggle-btn-btn" id="btn_random">random: false</button>
            <input type="hidden" id="input_random" value="false" />
          </div>
          <div class="form-row">
            <label for="cmdparam_global">global</label>
            <button type="button" class="toggle-btn-btn" id="btn_global">global: false</button>
            <input type="hidden" id="input_global" value="false" />
          </div>
        `;
      } else if (p !== 'random' && p !== 'global') {
        fields.innerHTML += `
          <div class="form-row">
            <label for="cmdparam_${p}">${p}</label>
            <input id="cmdparam_${p}" placeholder="${p}">
          </div>
        `;
      }
    });

    // Setup add id button and handlers
    document.querySelector('.addStringBtn').onclick = () => {
      const container = document.getElementById('addDataIdsContainer');
      const div = document.createElement('div');
      div.className = 'form-row';
      div.innerHTML = `
        <input class="input-string" placeholder="Enter Id" style="flex:1; margin-right:8px;" />
        <button type="button" class="trade-subbtn removeStringBtn">Remove</button>
      `;
      container.appendChild(div);
      div.querySelector('.removeStringBtn').onclick = () => div.remove();
    };

    // Setup toggle buttons for random/global
    ['random','global'].forEach(p => {
      const btn = document.getElementById('btn_' + p);
      const hiddenInput = document.getElementById('input_' + p);
      btn.onclick = () => {
        const current = hiddenInput.value === 'true';
        hiddenInput.value = (!current).toString();
        btn.textContent = `${p}: ${!current}`;
        btn.classList.toggle('active', !current);
      };
    });

    // Override addCmdBtn onclick to get list and toggles
    document.getElementById('addCmdBtn').onclick = () => {
      const ids = [];
      document.querySelectorAll('#addDataIdsContainer input.input-string').forEach(input => {
        if (input.value.trim()) ids.push(input.value.trim());
      });
      const params = {};
      params.ids = ids;
      params.random = document.getElementById('input_random').value === 'true';
      params.global = document.getElementById('input_global').value === 'true';

      curr.params.forEach(p => {
        if (['ids', 'random', 'global'].includes(p)) return;
        const val = document.getElementById('cmdparam_' + p);
        if (val && val.value) params[p] = val.value;
      });

      tempCmds.push({ cmd: sel, params });
      renderCmdList();
    };
    return;
  }

  // Existing trade command or others handled here...

  // Normal param inputs for other commands
  if (curr.params) {
    curr.params.forEach(p => {
      fields.innerHTML += `
        <div class="form-row">
          <label for="cmdparam_${p}">${p}</label>
          <input id="cmdparam_${p}" placeholder="${p}">
        </div>
      `;
    });
  }
  const btn = document.getElementById('addCmdBtn');
  btn.removeEventListener('click', addCmd); // Remove any prior
  btn.addEventListener('click', addCmd);
}

}



function populateEventTypeSelector() {
  const sel = document.getElementById('eventTypeSel');
  sel.innerHTML = '';
  eventTypes.forEach(ev => {
    const opt = document.createElement('option');
    opt.value = ev.name;
    opt.textContent = ev.name;
    sel.appendChild(opt);
  });
}

function onEventTypeSelect() {
  const sel = document.getElementById('eventTypeSel').value;
  const fields = document.getElementById('paramFields');
  fields.innerHTML = '';
  const curr = eventTypes.find(ev => ev.name === sel);
  if (!curr) return;
  if (curr.params) {
    curr.params.forEach(p => {
      fields.innerHTML += `
        <div class="form-row">
          <label for="param_${p}">${p}</label>
          <input id="param_${p}" placeholder="${p}">
        </div>
      `;
    });
  }
}

function populateCmdTypeSelector() {
  const sel = document.getElementById('cmdTypeSel');
  sel.innerHTML = '';
  commandTypes.forEach(c => {
    const emojiStr = c.emoji ? ` ${c.emoji}` : '';
    const opt = document.createElement('option');
    opt.value = c.cmd;
    opt.textContent = `${c.cmd}${emojiStr}`;
    sel.appendChild(opt);
  });
}

function onCmdTypeSelect() {
  const sel = document.getElementById('cmdTypeSel').value;
  const fields = document.getElementById('cmdFields');
  fields.innerHTML = '';
  const curr = commandTypes.find(c => c.cmd === sel);

  // Handle 'trade' with dynamic arrays
  if (sel === 'trade') {
    fields.innerHTML = `
      <div>
        <strong>From Items:</strong>
        <div id="tradeFromFields"></div>
        <button type="button" id="addTradeFromBtn" class="trade-subbtn">+ Add From Item</button>
      </div>
      <div style="margin-top:13px;">
        <strong>To Items:</strong>
        <div id="tradeToFields"></div>
        <button type="button" id="addTradeToBtn" class="trade-subbtn">+ Add To Item</button>
      </div>
    `;

    // internal arrays for values
    let tradeFromArr = [{}];
    let tradeToArr = [{}];

    function readTradeArr(where, type) {
      let arr = [];
      let idx = 0, itemEl, qtEl;
      while ((itemEl = document.getElementById(type + "Item" + idx))) {
        let item = itemEl.value;
        qtEl = document.getElementById(type + "Qt" + idx);
        let quantity = qtEl ? qtEl.value : "";
        if (item || quantity) arr.push({ item, quantity });
        idx++;
      }
      return arr;
    }

    function renderTradeArr(arr, where, type) {
      const container = document.getElementById(where);
      container.innerHTML = arr
        .map((v, i) => `
          <div class="form-row" data-index="${i}">
            <input placeholder="item" value="${v.item || ''}" id="${type}Item${i}" style="max-width:120px;" />
            <input placeholder="quantity" type="number" min="0" value="${v.quantity || ''}" id="${type}Qt${i}" style="max-width:90px;margin-left:7px;" />
            <button type="button" class="trade-subbtn" style="margin-left:10px;" onclick="(function(btn){
              let par = btn.parentNode, idx=par.getAttribute('data-index');
              par.remove();
              // Update array will occur on next add or submit
            })(this)">Remove</button>
          </div>
        `)
        .join('');
    }

    // Initial render
    renderTradeArr(tradeFromArr, 'tradeFromFields', 'from');
    renderTradeArr(tradeToArr, 'tradeToFields', 'to');

    document.getElementById('addTradeFromBtn').onclick = () => {
      tradeFromArr = readTradeArr('tradeFromFields', 'from');
      tradeFromArr.push({});
      renderTradeArr(tradeFromArr, 'tradeFromFields', 'from');
    };
    document.getElementById('addTradeToBtn').onclick = () => {
      tradeToArr = readTradeArr('tradeToFields', 'to');
      tradeToArr.push({});
      renderTradeArr(tradeToArr, 'tradeToFields', 'to');
    };

    document.getElementById('addCmdBtn').onclick = function () {
      let fromArr = readTradeArr('tradeFromFields', 'from').filter(x => x.item);
      let toArr = readTradeArr('tradeToFields', 'to').filter(x => x.item);
      tempCmds.push({ cmd: 'trade', params: { from: fromArr, to: toArr } });
      renderCmdList();
    };
    return; // Do not fall-through to default param logic
  }

  // Default param logic for all other commands
  if (!curr) return;
  if (curr.params) {
    curr.params.forEach(p => {
      fields.innerHTML += `
        <div class="form-row">
          <label for="cmdparam_${p}">${p}</label>
          <input id="cmdparam_${p}" placeholder="${p}">
        </div>
      `;
    });
  }
  const btn = document.getElementById('addCmdBtn');
    btn.removeEventListener('click', addCmd); // Remove any prior
    btn.addEventListener('click', addCmd);
}



function addCmd() {
  const cmdName = document.getElementById('cmdTypeSel').value;
  const curr = commandTypes.find(c => c.cmd === cmdName);
  const params = {};
  curr && curr.params.forEach(p => {
    const val = document.getElementById('cmdparam_' + p).value;
    if (val !== '') params[p] = val;
  });
  tempCmds.push({cmd: cmdName, params});
  renderCmdList();
}

function renderCmdList() {
  const list = document.getElementById('cmdsPreview');
  list.innerHTML = '<h4>Commands for this event:</h4>';
  if (!tempCmds.length) {
    list.innerHTML += '<em>No commands yet.</em>';
    return;
  }
  tempCmds.forEach((cmd, idx) => {
    list.innerHTML += `
      <div class="cmd-item">
        <strong>${cmd.cmd}</strong>: ${Object.keys(cmd.params).length ? JSON.stringify(cmd.params) : '<em>None</em>'}
        <span class="cmd-remove" onclick="removeCmd(${idx})" style="color:#fa0; cursor:pointer;">Remove</span>
      </div>
    `;
  });
}

function removeCmd(idx) {
  tempCmds.splice(idx, 1);
  renderCmdList();
}

function addEvent() {
  const type = document.getElementById('eventTypeSel').value;
  const curr = eventTypes.find(ev => ev.name === type);
  const params = {};
  curr && curr.params.forEach(p => {
    const el = document.getElementById('param_' + p);
    const val = el ? el.value : '';
    if (val !== "" || p !== "nb") params[p] = val;
  });
  const idString = document.getElementById('idString').value;
  const disabled = isDisabledAtStart;
  const cmds = tempCmds.map(c => ({cmd: c.cmd, params: c.params}));
  const evt = { eventType: type, params, cmds };
  if (idString) evt.id = idString;
  if (disabled) evt.disabled = true;
  events.push(evt);
  tempCmds = [];
  renderCmdList();
  refreshEventList();
}

function refreshEventList() {
  const list = document.getElementById('eventsList');
  list.innerHTML = '';
  if (!events.length) {
    list.innerHTML = '<em>No events yet.</em>';
    return;
  }
  events.forEach((evt, idx) => {
    list.innerHTML += `
      <div class="event-item">
        <strong>Type:</strong> ${evt.eventType}<br>
        ${evt.id ? `<strong>ID:</strong> ${evt.id}<br>` : ""}
        ${evt.disabled ? `<strong>Disabled:</strong> true<br>` : ""}
        <strong>Params:</strong> ${Object.keys(evt.params).length ? JSON.stringify(evt.params) : '<em>None</em>'}
        <div class="cmd-list">
          <strong>Cmds:</strong>
          ${evt.cmds && evt.cmds.length
            ? evt.cmds.map(c => `<div><strong>${c.cmd}</strong>: ${Object.keys(c.params).length ? JSON.stringify(c.params) : '<em>None</em>'}</div>`).join("")
            : "<em>No commands</em>"
          }
        </div>
        <button class="remove-btn" onclick="removeEvent(${idx})">Remove</button>
      </div>
    `;
  });
}

function removeEvent(idx) {
  events.splice(idx, 1);
  refreshEventList();
}

function exportJSON() {
  const dataStr = JSON.stringify(events, null, 2);
  const blob = new Blob([dataStr], {type: 'application/json'});
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'gamemode_events.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {window.URL.revokeObjectURL(url); a.remove();}, 700);
}

function applyJSON() {
  const val = document.getElementById('jsonArea').value;
  try {
    const arr = JSON.parse(val);
    if (Array.isArray(arr)) {
      events = arr;
      refreshEventList();
      alert("JSON applied!");
    } else {
      alert("Invalid JSON input.");
    }
  } catch(e){
    alert("Error parsing JSON: " + e);
  }
}

function fileImportJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    document.getElementById('jsonArea').value = ev.target.result;
  };
  reader.readAsText(file);
}

// Documentation & Links tabs unchanged, except they support emoji and new color
async function showDocumentationTab() {
  showTabs();
  const body = document.getElementById('tabContainer');
  body.innerHTML = `
    <div class="documentation-content">
      <h2 class="doc-title">Documentation</h2>
      <div class="docu-nav">
        <button onclick="scrollDocSection('eventtypes')">Event Types</button>
        <button onclick="scrollDocSection('commands')">Commands</button>
        <button onclick="scrollDocSection('discordcmds')">Discord Cmds</button>
      </div>
      <div id="documentationSections"></div>
    </div>
  `;
  const [events, commands, discordCmds] = await Promise.all([
    fetchData('event_types.json'),
    fetchData('commands.json'),
    fetchData('discord_cmds.json')
  ]);
  let sectionHTML = `
    <h3 class="doc-section-title" id="docu-eventtypes">Event Type List</h3>
    <ul>
      ${events.map(ev=>`
        <li>
          <strong>${ev.name}</strong>
          ${ev.params && ev.params.length ? `<br>Params: <code>${ev.params.join(', ')}</code>` : ""}
          ${ev.description ? `<br>${ev.description}` : ""}
          ${ev.example_links && ev.example_links.length ?
            `<br>Example: ${ev.example_links.map(l=>`<a href="${l}" target="_blank">${l}</a>`).join(", ")}`
            : ""}
        </li>
      `).join('')}
    </ul>
    <hr>
    <h3 class="doc-section-title" id="docu-commands">Event Commands List</h3>
    <ul>
      ${commands.map(cmd=>`
        <li>
          <strong>${cmd.cmd}${(cmd.emoji) ? " " + cmd.emoji : ""}</strong>
          ${cmd.params && cmd.params.length ? `<br>Params: <code>${cmd.params.join(', ')}</code>` : ""}
          ${cmd.description ? `<br>${cmd.description}` : ""}
          ${cmd.example_links && cmd.example_links.length ?
            `<br>Example: ${cmd.example_links.map(l=>`<a href="${l}" target="_blank">${l}</a>`).join(", ")}`
            : ""}
        </li>
      `).join('')}
    </ul>
    <div style="color:#91e3ff;font-size:1em;margin:12px 0 12px 0;">
      <span>📚 For item list and building life see <a href="https://devast.io/commands/#item" target="_blank">devast.io/commands/#item</a></span>
    </div>
    <hr>
    <h3 class="doc-section-title" id="docu-discordcmds">Discord Commands List</h3>
    <div id="discordCmdsContainer"></div>   
  `;
  document.getElementById('documentationSections').innerHTML = sectionHTML;
  document.getElementById('discordCmdsContainer').innerHTML = `
  <ul>
    ${discordCmds.map(d => `
      <li>
        <code>${d.cmd}</code>
        ${d.description ? `<br><small>Description: ${d.description}</small>` : ''}
        ${d.example_links && d.example_links.length ? `
        <br><small>Examples: ${
            d.example_links
            .map(link =>
                link.startsWith('https')
                ? `<a href="${link}" target="_blank">${link}</a>`
                : `<span class="not-a-link">${link}</span>`
            )
            .join('<br>')
        }</small>
        ` : ''}



      </li>
    `).join('')}
  </ul>
`;
}
window.scrollDocSection = function(target) {
  const el = document.getElementById('docu-' + target);
  if (el) el.scrollIntoView({behavior:"smooth", block:"center"});
};

function showLinksTab() {
  showTabs();
  const body = document.getElementById('tabContainer');
  body.innerHTML = `
    <div class="links-content">
      <h2>Links</h2>
      <ul>
        <li><a href="https://devast.io/?name=private2" target="_blank">The Devast.io server (#2)</a></li>
        <li><a href="https://discord.gg/nMjJthgJTa" target="_blank">Caissier Discord, where you can enter in-game commands</a></li>
        <li><a href="https://discord.com/invite/njg9j9sYBC" target="_blank">Official Devast.io Discord</a></li>
        <li><a href="https://caissier.github.io/devastMapEditorPlusPlus/" target="_blank">An unofficial Map Editor for devast</a></li>
      </ul>
    </div>
  `;
}

// Start app
window.addEventListener('DOMContentLoaded', () => {
  showTabs();
  switchTab("eventType");
});
