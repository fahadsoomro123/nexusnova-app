import { defineConfig } from 'playwright/test';
export default defineConfig({
  testDir:'./',
  timeout:30000,
  use:{baseURL:'http://127.0.0.1:3000/veytrix/',headless:true,serviceWorkers:'block'},
  reporter:[['line'],['html',{outputFolder:'playwright-report',open:'never'}]],
  webServer:{command:'node ../../server.js',url:'http://127.0.0.1:3000/veytrix/',reuseExistingServer:false,timeout:30000}
});
