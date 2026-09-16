export const NAV = [
  ['home','Home'],['mission','Mission'],['build','Build'],['artifacts','Artifacts'],['history','History'],
  ['projects','Projects'],['selfheal','Self-Healing'],['verification','Verification'],['github','GitHub'],['security','Security']
];
export const PRIMARY = ['home','mission','build','artifacts','history'];
export const SUGGESTIONS = ['Build APK','Run tests','Repair failing tests','Verify latest artifact','Inspect failed build','Create release','Check GitHub','Fetch changes','Run verification'];
export const RAIL = ['Plan','Implement','Build','Test','Repair','Verify','Artifact'];
export const PROJECT = { repo:'fahadsoomro123/nexusnova-app', branch:'ai-photo-real-canva-ai-generator-correction', source:'Existing NexusNova infrastructure', liveConnection:false };
export const COMMANDS = {
  'Build APK': {action:'build'}, 'Run tests':{action:'test'}, 'Repair failing tests':{action:'repair'},
  'Verify latest artifact':{action:'verify'}, 'Inspect failed build':{action:'mission'}, 'Create release':{action:'release'},
  'Check GitHub':{action:'github'}, 'Fetch changes':{action:'github'}, 'Run verification':{action:'verify'}
};
export const DEMO_LOGS = [
  ['22:14:03','PLAN','Mission accepted: Build APK + verify delivery chain.'],
  ['22:14:05','PLAN','Resolved project context and execution policy.'],
  ['22:14:08','CODE','Implementation workspace ready.'],
  ['22:14:14','BUILD','Build target queued; environment checks pending.'],
  ['22:14:19','TEST','Test suite entered execution.'],
  ['22:14:24','FAIL','Demonstration failure: fixture test reports a reproducible assertion.'],
  ['22:14:28','REPAIR','Diagnosis generated from failure signal.'],
  ['22:14:34','RETEST','Repair candidate applied in demonstration state.'],
  ['22:14:41','VERIFY','Verification chain awaiting external artifact evidence.']
];
