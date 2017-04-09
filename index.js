'use strict';

const electron = require('electron');  
const app = electron.app;  
const BrowserWindow = electron.BrowserWindow;
const winWidth = 1024;
const winHeight = 768;

let mainWindow;

app.on('window-all-closed', function() {  
  if(process.platform != 'darwin') {
    app.quit();
  }
});

app.on('ready', function() {  
  mainWindow = new BrowserWindow({width: winWidth, height: winHeight, minWidth: winWidth, minHeight: winHeight});
  mainWindow.loadURL('file://' + __dirname + '/index.html');

  mainWindow.on('closed', function() {
    mainWindow = null;
  });
});