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
const meli = require('mercadolibre');

const facebook_client_id = '271293853330276';
const meli_client_id = '4976531702683706';
const meli_secret_key = '4yjcHFSAK86u9DFONOJ0AZLAEaXRhD17';

var meliObject = null;

var facebook_user_access_token = null;
var meli_user_access_token = null;
var meli_user_id = null;

let mainWindow;

app.on('window-all-closed', function () {
    if(process.platform != 'darwin') {
      /*mainWindow.webContents.session.clearStorageData({storages:["appcache", "cookies"]}, function(){
        console.log("STORAGE CLEAR");
        app.quit();
      });*/
      app.quit();
  }
});

app.on('ready', function () {
  mainWindow = new BrowserWindow({width: winWidth, height: winHeight, minWidth: winWidth, minHeight: winHeight, frame: false, show: false});
  mainWindow.loadURL('file:///' + __dirname + "/index.html");

  mainWindow.webContents.on('did-finish-load', function() {
    mainWindow.webContents.session.clearStorageData({storages:["appcache", "cookies"]}, function(){
        console.log("STORAGE CLEAR");
      });
    mainWindow.show();
  });

  mainWindow.on('closed', function() {
    mainWindow = null;
  });

  mainWindow.setSize(winWidth,winHeight); // Black screen error fixed

  function updateFacebook(event, data){
    var pages = {}
    for (var i = 0, len = data.pages.length; i < len; i++){
      var page = data.pages[i];
      pages[page.id] = page;
    }

    var msg = {profile: data.profile, page_count: data.pages.length, pages: pages};
    mainWindow.webContents.send("update-facebook", msg);
  };

  function updateMercadoLibre(event, data){
    var msg = {nickname: data.nickname}
    mainWindow.webContents.send("update-mercadolibre", msg);
  }

  function loginFacebook(event){
    var options = {
        client_id: facebook_client_id,
        scopes: ["public_profile", "user_friends", "manage_pages", "read_insights"],
        redirect_uri: "https://www.facebook.com/connect/login_success.html"
      };
    var facebookAuthURL = "https://www.facebook.com/dialog/oauth?client_id=" + options.client_id + "&redirect_uri=" + options.redirect_uri + "&response_type=token,granted_scopes&scope=" + options.scopes + "&display=popup";
    
    var authWindow = new BrowserWindow({ width: 450, height: 300, show: false, webPreferences: {nodeIntegration: false}});
    authWindow.loadURL(facebookAuthURL);
    authWindow.show();
    authWindow.webContents.on('did-get-redirect-request', function (event2, oldUrl, newUrl) {
      var raw_code = /access_token=([^&]*)/.exec(newUrl) || null;
      facebook_user_access_token = (raw_code && raw_code.length > 1) ? raw_code[1] : null;
      var error = /\?error=(.+)$/.exec(newUrl);
      if(facebook_user_access_token) {
        FB.setAccessToken(facebook_user_access_token);
        var data = []
        FB.api('/me', { fields: ['id', 'name', 'picture.width(150).height(150)'] }, function (res) {
          data.profile = res;
          FB.api('/me/accounts',function (res) {
            data.pages = res.data
            updateFacebook(event, data);
            authWindow.close();
          });
        });
      };
    });
  };

  function loginMercadoLibre(event){
    var authURL = 'https://auth.mercadolibre.com.ve/authorization?response_type=token&client_id='+meli_client_id;
    var authWindow = new BrowserWindow({ width: 450, height: 450, show: false, webPreferences: {nodeIntegration: false}});
    authWindow.loadURL(authURL);
    authWindow.show();
    authWindow.webContents.on('did-get-redirect-request', function (event2, oldUrl, newUrl) {
      var raw_code = /access_token=([^&]*)/.exec(newUrl) || null;
      meli_user_access_token = (raw_code && raw_code.length > 1) ? raw_code[1] : null;
      var error = /\?error=(.+)$/.exec(newUrl);
      if(meli_user_access_token){
        meliObject = new meli.Meli(meli_client_id, meli_secret_key, meli_user_access_token);
        meliObject.get('/users/me', function(err, res){
          console.log(err, res);
          meli_user_id = res.id;
          updateMercadoLibre(event, res)
          authWindow.close();
        });
      }
    });
  };

  ipc.on("facebook-login-button-clicked",function (event, arg) {
    if(facebook_user_access_token){
      FB.setAccessToken(facebook_user_access_token);
      FB.api('/me/permissions?method=DELETE', function(res){
          facebook_user_access_token = null;
          loginFacebook(event);
        });
      }
    else  {
      loginFacebook(event);
    }
  });

  ipc.on("update-facebook-page", function(event, arg){
    
    var msg = {id:arg.id, name:arg.name};

    var days_28 = new Date();
    days_28.setDate(days_28.getDate()-29);
    days_28 = parseInt(days_28.getTime()/1000);

    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate()-1);
    yesterday = parseInt(yesterday.getTime()/1000);

    FB.api('/'+arg.id, {fields:['fan_count', 'picture.width(100).height(100)']}, function(res){
      msg.fans = res.fan_count;
      msg.picture = res.picture;

      FB.api('/'+arg.id+'/insights', {period: 'days_28', metric: ['page_impressions_organic_unique', 'page_impressions_paid_unique', 'page_engaged_users'], since:days_28, until:yesterday}, function(res){
        console.log(res)
        msg.impressions_organic_unique = res.data[0].values[0].value;
        msg.impressions_paid_unique = res.data[1].values[0].value;
        msg.engaged_users = res.data[2].values[0].value;
        mainWindow.webContents.send("update-facebook-page", msg);
      });
    });
  });

  ipc.on("mercadolibre-login-button-clicked",function (event, arg) {
    if(meli_user_access_token){
      meliObject.delete('/users/'+meli_user_id+'/applications/'+meli_client_id, function(res){
          console.log(res);
          meli_user_access_token = null;
          meli_user_id = null;
          loginMercadoLibre(event);
        });
      }
    else  {
      loginMercadoLibre(event);
    }
  });
});
