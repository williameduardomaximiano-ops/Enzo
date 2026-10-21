'use strict';

// Electron BrowserWindow.getBounds() and Display.bounds both use desktop DIP coordinates.
// Only hide the assistant if it intersects the display being captured.
function rectanglesOverlap(a,b){
 if(!a||!b)return false;
 const values=[a.x,a.y,a.width,a.height,b.x,b.y,b.width,b.height];
 if(!values.every(v=>typeof v==='number'&&Number.isFinite(v)))return false;
 if(a.width<=0||a.height<=0||b.width<=0||b.height<=0)return false;
 return a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
}
module.exports={rectanglesOverlap};
