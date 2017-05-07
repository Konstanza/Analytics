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

const session = electron.session;
var user_access_token = null;

let mainWindow;

app.on('window-all-closed', function () {
    if(process.platform != 'darwin') {
      mainWindow.webContents.session.clearStorageData({storages:["appcache", "cookies"]}, function(){
        console.log("STORAGE CLEAR")
        app.quit();
      });
  }
});

app.on('ready', function () {
  mainWindow = new BrowserWindow({width: winWidth, height: winHeight, minWidth: winWidth, minHeight: winHeight, frame: false, show: false});
  mainWindow.loadURL('file:///' + __dirname + "/index.html");

  mainWindow.webContents.on('did-finish-load', function() {
    mainWindow.show();
  });

  mainWindow.on('closed', function() {
    mainWindow = null;
  });

  mainWindow.setSize(winWidth,winHeight); // Black screen error fixed

  var updateFacebook = function(event, data){
    var msg = {profile: data.profile};
    console.log(msg)
    mainWindow.webContents.send("update-facebook", msg);
  };

  var loginFacebook = function(event){
    var options = {
        client_id: '271293853330276',
        scopes: ["public_profile"],
        redirect_uri: "https://www.facebook.com/connect/login_success.html"
      };
    var facebookAuthURL = "https://www.facebook.com/dialog/oauth?client_id=" + options.client_id + "&redirect_uri=" + options.redirect_uri + "&response_type=token,granted_scopes&scope=" + options.scopes + "&display=popup";
    
    var authWindow = new BrowserWindow({ width: 450, height: 300, show: false, webPreferences: {nodeIntegration: false}});
    authWindow.loadURL(facebookAuthURL);
    authWindow.show();
    authWindow.webContents.on('did-get-redirect-request', function (event2, oldUrl, newUrl) {
      var raw_code = /access_token=([^&]*)/.exec(newUrl) || null;
      user_access_token = (raw_code && raw_code.length > 1) ? raw_code[1] : null;
      var error = /\?error=(.+)$/.exec(newUrl);
      if(user_access_token) {
        FB.setAccessToken(user_access_token);
        var data = []
        FB.api('/me', { fields: ['id', 'name', 'picture.width(150).height(150)'] }, function (res) {
          data.profile = res;
          authWindow.close();
          updateFacebook(event, data);
        });
      };
    });
  };

  ipc.on("facebook-login-button-clicked",function (event, arg) {
    if(user_access_token){
      FB.setAccessToken(user_access_token);
      FB.api('/me/permissions?method=DELETE', function(res){
          console.log(res)
          user_access_token = null;
          loginFacebook(event);
        });
      }
    else  {
      loginFacebook(event);
    }
  });
});
