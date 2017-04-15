'use strict';

const electron = require('electron');  
const app = electron.app;  
const ipc = electron.ipcMain;
const BrowserWindow = electron.BrowserWindow;
const winWidth = 800; //1024
const winHeight = 600; //768

const events = require('events');
const eventEmitter = new events.EventEmitter();
const FB = require('fb');

let mainWindow;

app.on('window-all-closed', function() {  
  if(process.platform != 'darwin') {
    app.quit();
  }
});

app.on('ready', function() {  
  mainWindow = new BrowserWindow({width: winWidth, height: winHeight, minWidth: winWidth, minHeight: winHeight, frame: false, show: false});
  mainWindow.loadURL('file://' + __dirname + '/index.html');

  mainWindow.webContents.on('did-finish-load', function() {
    mainWindow.show();
  });

  mainWindow.on('closed', function() {
    mainWindow = null;
  });

  mainWindow.setSize(winWidth,winHeight); // Black screen error fixed
  
  ipc.on("facebook-button-clicked",function (event, arg) {
    var options = {
      client_id: '271293853330276',
      scopes: "public_profile",
      redirect_uri: "https://www.facebook.com/connect/login_success.html"
    };
    var authWindow = new BrowserWindow({ width: 450, height: 300, show: false, 'node-integration': false });
    var facebookAuthURL = "https://www.facebook.com/dialog/oauth?client_id=" + options.client_id + "&redirect_uri=" + options.redirect_uri + "&response_type=token,granted_scopes&scope=" + options.scopes + "&display=popup";
    authWindow.loadURL(facebookAuthURL);
    authWindow.show();
    authWindow.webContents.on('did-get-redirect-request', function (event, oldUrl, newUrl) {
      var raw_code = /access_token=([^&]*)/.exec(newUrl) || null;
      var access_token = (raw_code && raw_code.length > 1) ? raw_code[1] : null;
      var error = /\?error=(.+)$/.exec(newUrl);
      if(access_token) {
        FB.setAccessToken(access_token);
        FB.api('/me', { fields: ['id', 'name', 'picture.width(150).height(150)'] }, function (res) {
          mainWindow.webContents.executeJavaScript("document.getElementById(\"facebook-name\").innerHTML = \" " + res.name + "\"");
          //mainWindow.webContents.executeJavaScript("document.getElementById(\"fb-id\").innerHTML = \" ID: " + res.id + "\"");
          mainWindow.webContents.executeJavaScript("document.getElementById(\"facebook-profile-picture\").src = \"" + res.picture.data.url + "\"");
        });
        authWindow.close();
      }
    });
  });
});