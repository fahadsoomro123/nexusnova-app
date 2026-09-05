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
