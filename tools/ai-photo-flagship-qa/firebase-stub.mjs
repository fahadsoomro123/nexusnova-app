const auth={currentUser:null};
export const getApps=()=>[];
export const initializeApp=config=>({config});
export const getAuth=()=>auth;
export const onAuthStateChanged=(_auth,callback)=>{queueMicrotask(()=>callback(auth.currentUser));return()=>{}};
export const getFirestore=()=>({});
export const doc=(...parts)=>({parts});
export const getDoc=async()=>({exists:()=>false,data:()=>({})});
export const onSnapshot=(_ref,next)=>{queueMicrotask(()=>next?.({exists:()=>false,data:()=>({})}));return()=>{}};
export const runTransaction=async(_db,callback)=>callback({get:getDoc,set:()=>{},update:()=>{}});
export class CustomProvider{constructor(options={}){Object.assign(this,options)}}
export class ReCaptchaEnterpriseProvider{constructor(key){this.key=key}}
export const initializeAppCheck=()=>({});
export const getToken=async()=>({token:'qa-app-check-token'});

export class GoogleAIBackend{constructor(options={}){Object.assign(this,options)}}
export const getAI=(app,options={})=>({app,options});
export const getGenerativeModel=(_ai,options={})=>({
  async generateContent(parts=[]){
    globalThis.__qaFirebaseAiCalls=globalThis.__qaFirebaseAiCalls||[];
    globalThis.__qaFirebaseAiCalls.push({systemInstruction:options.systemInstruction||'',parts});
    await new Promise(resolve=>setTimeout(resolve,55));
    if(globalThis.__qaFirebaseAiFail)throw new Error('QA Firebase AI forced failure');
    const system=String(options.systemInstruction||'');
    if(/Return only requested JSON adjustment values/i.test(system)){
      return{response:{text:()=>JSON.stringify({exposure:.35,brightness:8,contrast:14,highlights:-18,shadows:16,whites:6,blacks:-5,temperature:7,tint:2,vibrance:13,saturation:4,clarity:9,dehaze:5,sharpness:17,noiseReduction:12,vignette:5,fade:2})}};
    }
    return{response:{text:()=> 'Lift shadows slightly, protect highlights, keep white balance natural, crop only if needed, and preserve realistic skin texture and edge detail.'}};
  }
});
