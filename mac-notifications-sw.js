/* MAC Vision — system notifications. No offline cache, no interception of app traffic. */
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
   const home=new URL('./',self.registration.scope).href;
   const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
   const existing=windows.find(client=>client.url.startsWith(home));
   if(existing){await existing.focus();return;}
   await self.clients.openWindow(home);
 })());
});
