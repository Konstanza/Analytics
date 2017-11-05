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
var Twitter = require('twitter');

const facebook_client_id = '';
const meli_client_id = '';
const meli_secret_key = '';

const twitter_client = new Twitter({
  consumer_key: '',
  consumer_secret: '',
  access_token_key: '',
  access_token_secret: ''
});

var meliObject = null;

var facebook_user_access_token = null;
var meli_user_access_token = null;
var meli_user_id = null;

let mainWindow;

var loading = 0;

app.on('window-all-closed', function () {
    if(process.platform != 'darwin') {
      mainWindow.webContents.session.clearStorageData({storages:["appcache", "cookies"]}, function(){
        console.log("STORAGE CLEAR");
        app.quit();
      });
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

  function addLoad() {
    loading = loading+1;

    if(loading == 1) {
      mainWindow.webContents.send("load", true);
    } 
  }

  ipc.on("sub-load", function(event, arg) {
      loading = loading-1;

      if(loading <= 0) {
        mainWindow.webContents.send("load", false);
        loading = 0;
      } 
  });

  function updateFacebook(event, data){
    var pages = {}
    for (var i = 0, len = data.pages.length; i < len; i++){
      var page = data.pages[i];
      pages[page.id] = page;
    }

    var msg = {profile: data.profile, page_count: data.pages.length, pages: pages};
    mainWindow.webContents.send("update-facebook", msg);
  };

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
        addLoad();

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

  function updateMercadoLibre(event, data){
    var msg = {
      nickname: data.nickname,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      id_type: data.identification.type,
      id_number: data.identification.number,
      user_type: data.user_type,
      points: data.points,
      seller_exp: data.seller_experience,
      seller_comp_trans: data.seller_reputation.transactions.completed,
      seller_canc_trans: data.seller_reputation.transactions.canceled,
      buyer_comp_trans: data.buyer_reputation.transactions.completed,
      buyer_canc_trans: data.buyer_reputation.canceled_transactions
    }
    mainWindow.webContents.send("update-mercadolibre", msg);
  }

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
        addLoad();

        meliObject = new meli.Meli(meli_client_id, meli_secret_key, meli_user_access_token);
        meliObject.get('/users/me', function(err, res){
          //console.log(err, res);
          meli_user_id = res.id;
          updateMercadoLibre(event, res)
          authWindow.close();
        });
      }
    });
  };

  function updateTwitter(error, data, response){
    var msg = { 
      name: data[0].user.name,
      screen_name:  data[0].user.screen_name,
      location:  data[0].user.location,
      followers_count:  data[0].user.followers_count,
      friends_count:  data[0].user.friends_count,
      statuses_count:  data[0].user.statuses_count,
      favourites_count:  data[0].user.favourites_count,
      profile_image_url: data[0].user.profile_image_url
    }
    mainWindow.webContents.send("update-twitter", msg);
  }

  ipc.on("get-twitter-data", function (event, arg) {
    addLoad();

    var params = {
      screen_name: arg, 
      count: 3, 
      //lang: eu,
      //since: 2017-07-19
    };

    twitter_client.get('statuses/user_timeline', params, updateTwitter);
  });

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

    addLoad();

    FB.api('/'+arg.id, {fields:['fan_count', 'picture.width(500).height(500)']}, function(res){
      msg.fans = res.fan_count;
      msg.picture = res.picture;

      FB.api('/'+arg.id+'/insights', {period: 'days_28', metric: ['page_impressions_organic_unique', 'page_impressions_paid_unique', 'page_engaged_users'], since:days_28, until:yesterday}, function(res){
        //console.log(res)
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
          //console.log(res);
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
