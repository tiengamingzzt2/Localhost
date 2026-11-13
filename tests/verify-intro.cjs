const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const js = fs.readFileSync('public/intro.js', 'utf8');

const ids = [
  'introScreen', 'workspaceShell', 'enterWorkspaceBtn', 'heroStartBtn',
  'heroDemoBtn', 'introThemeToggle', 'skillsDialog', 'hitlDialog',
  'previewDialog', 'previewDialogTitle', 'previewDialogContent', 'aboutDialog',
  'btnSkillsToWorkspace', 'btnHitlToWorkspace', 'btnPreviewToWorkspace',
  'introNavSkills', 'introNavRules', 'introNavGuide', 'cardProfile',
  'cardGuardrail', 'cardRevenue', 'proofContracts', 'proofHitl',
  'proofStaging', 'proofRevenue'
];

let missing = [];
for (const id of ids) {
  if (!html.includes(`id="${id}"`) && !html.includes(`id='${id}'`)) {
    missing.push(id);
  }
}

if (missing.length > 0) {
  console.error('ERROR: Missing IDs in HTML:', missing);
  process.exit(1);
} else {
  console.log('SUCCESS: All 25 interactive element IDs exist in index.html!');
}

// Check JS syntax
try {
  new Function(js);
  console.log('SUCCESS: intro.js syntax is 100% valid!');
} catch (e) {
  console.error('ERROR: intro.js syntax error:', e);
  process.exit(1);
}

