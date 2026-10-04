import assert from 'node:assert/strict';
import NexusNovaVideoEditor from '../fresh-rebuild/assets/js/nn-video-studio-core.js';

const editor = new NexusNovaVideoEditor({
  zoom:100,
  tracks:[{id:'v1',type:'video',name:'V1',zIndex:0},{id:'v2',type:'overlay',name:'V2',zIndex:10}],
  clips:[{id:'a',trackId:'v1',name:'A',sourceDurationMs:10000,startMs:0,sourceInMs:0,sourceOutMs:10000,speed:1}]
});

assert.equal(editor.timeToPixels(2000,100),200);
assert.equal(editor.pixelsToTime(200,100),2000);
editor.setPlayheadMs(4000);
assert.equal(editor.playheadMs,4000);
editor.setSelection(['a'],'a');
const right=editor.splitClip('a',4000);
assert.equal(editor.project.clips.length,2);
assert.equal(editor.project.clips[0].durationMs,4000);
assert.equal(right.durationMs,6000);
editor.undo();
assert.equal(editor.project.clips.length,1);
editor.redo();
assert.equal(editor.project.clips.length,2);
editor.undo();
editor.trimClipLeft('a',1000);
assert.equal(editor.project.clips[0].sourceInMs,1000);
assert.equal(editor.project.clips[0].startMs,1000);
editor.undo();
editor.moveClip('a',2500,'v2');
assert.equal(editor.project.clips[0].startMs,2500);
assert.equal(editor.project.clips[0].trackId,'v2');
editor.undo();
assert.equal(editor.project.clips[0].trackId,'v1');
console.log('NexusNova AI Video Studio core smoke: 10 assertions passed.');
