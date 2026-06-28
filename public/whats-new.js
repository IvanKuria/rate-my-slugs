const params = new URLSearchParams(window.location.search);
const fromVersion = params.get('from');
const toVersion = params.get('to');

if (fromVersion && toVersion && fromVersion !== toVersion) {
  document.getElementById('version-badge').textContent =
    `v${fromVersion} \u2192 v${toVersion}`;
}
