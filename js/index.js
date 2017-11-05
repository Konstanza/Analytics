
(function(){
 
var  OAUTH2_CLIENT_ID= '503363864277-295gkn1vktue8vjs9qid4rpk7irfvm6p.apps.googleusercontent.com'; //AQUI VA EL CLIENTE ID DE LA APLICACIÓN DE YOUTUBE

var OAUTH2_SCOPES = [
    'https://www.googleapis.com/auth/yt-analytics.readonly',
    'https://www.googleapis.com/auth/youtube.readonly' //ESTOS SON LOS SCOPES, O SEA LO QUE CONTIENE LO QUE SE VA A CONSULTAR, UNA ESPECIE DE LIBRERIAS
  ];
  
  var channelId;
  var subs;
  var test;
  test= 1;
 var ONE_MONTH_IN_MILLISECONDS = 1000 * 60 * 60 * 24 * 30;
  // For information about the Google Chart Tools API, see:
  // https://developers.google.com/chart/interactive/docs/quick_start 
google.load('visualization', '1.0', {'packages': ['corechart']}); //ESTO ES IMPORTANTE, SIRVE PARA HACER FUNCIONAR LAS GRAFICAS
  

  window.onJSClientLoad = function(){ //HACE LA LLAMADA Y CARGA LA API
    gapi.auth.init(function(){
        window.setTimeout(checkAuth, test);
    });};





function checkAuth(){ //CHEQUEA LA AUTORIZACION DEL PROGRAMA
  gapi.auth.authorize({
      client_id: OAUTH2_CLIENT_ID,
      scope: OAUTH2_SCOPES,
      inmediate: true
  }, handleAuthResult); //ESTA FUNCION ES LA QUE PERMITE MOSTRAR LOS DATOS Y CERRAR SESIÓN

}

function handleAuthResult(authResult){ //METODO DE LO QUE DIJE ARRIBA
  if(authResult){ //SI HAY RESULTADO DE AUTORIZACION, O SEA SI HAY RESPUESTA
   
    $("#logout-link").click(function(){ //BOTON DE CERRAR SESION
        var token = gapi.auth.getToken(); //TODA ESTA FUNCION DE CERRAR SESION LO QUE HACE ES OBTENER EL TOKEN DE ACCESO Y DESTRUIRLO
        if(token){
          var script = document.createElement("script");
          script.src = "http://accounts.google.com/o/oauth2/revoke?token=" +token.access_token;
          document.body.appendChild(script);
          document.body.removeChild(script);
        }
        gapi.auth.setToken(null);
        handleAuthResult(null);
    }); //FIN DE LA LA DESTRUCCIÓN DE TOKEN

     $('.pre-auth').hide(); //ESTO SON VISTAS, DONDE SE OCULTA LO QUE CONTENGA LA CLASE PRE-AUTH EN EL HTML AL INICIAR SESION
    $('.post-auth').show(); //LO MISMO DE ARRIBA PERO AL CONTRARIO
    loadAPI(); //LLAMAMOS LA FUNCION PARA CARGAR LA API


  }else{
     $('.pre-auth').show();
     $('.post-auth').hide();
     $('#login-link').click(function(){

            gapi.auth.authorize({
              client_id: OAUTH2_CLIENT_ID,
                  scope: OAUTH2_SCOPES,
                  inmediate: false

            } , handleAuthResult);
     });
  }
}

function loadAPI(){ //FUNCION PARA CARGAR LA API
  gapi.client.load('youtube', 'v3', function(){

      gapi.client.load('youtubeAnalytics' , 'v1' , function(){

          getUserChannel();
      });
  });
}

function getUserChannel(){ //OBTIENE EL CANAL DEL USUARIO
  var request = gapi.client.youtube.channels.list({
    mine: true,
    part: 'id, contentDetails, statistics'
  });
  request.execute(function(response){
    if('error' in response){
      displayMessage(response.error.message);
    }else{
      channelId = response.items[0].id; // AQUI ESTAMOS PIDIENDO EL ID DEL CANAL
      subs = response.items[0].statistics.subscriberCount; //SUBSCRIPTORES
      var uploadsListId = response.items[0].contentDetails.relatedPlaylists.uploads; //LISTA DE VIDEOS
      getPlaylistItems(uploadsListId); //PASAMOS POR PARAMETRO LA LISTA DE LOS VIDEOS A ESA FUNCION
      displaychannelID(subs,channelId); //LO MISMO QUE ARRIBA PERO EL CANAL Y NUMERO DE SUBSCRIPTORES
    }
  });
}


function getPlaylistItems(listId){ //OBTIENE LA LISTA DE LOS VIDEOS
  var request = gapi.client.youtube.playlistItems.list({
    playlistId: listId,
    part: 'snippet'
  });

  request.execute(function(response){
    if('error' in response){
      document.write('error 1');
    }else{
      if('items' in response){
        var videoIds = $.map(response.items, function(item){
            return item.snippet.resourceId.videoId;
        });
        getVideo(videoIds);
      }else{
        document.write('no  hay videos en tu canal');
      }

    }
  });
}

function getVideo(videoIds){
  var request = gapi.client.youtube.videos.list({
    id: videoIds.join(','),
    part: 'id, snippet, statistics'

  });
  request.execute(function(response){
    if('error' in response){
      document.write('error 2');
    }else{
      var videolist = $("#video-list");
      $.each(response.items, function(){
        if(this.statistics.viewCount ==0){
          return;
        }
        var title = this.snippet.title;
        var videoId = this.id;
        var liElement = $('<li>');


          var aElement = $('<a>');
          aElement.attr('href', '#');

          aElement.text(title);
          aElement.click(function(){
            displayVideoAnalytics(videoId);
        });

            liElement.append(aElement);
            videolist.append(liElement);

      });
      if(videolist.children().length==0){
        document.write("tu canal no tiene videos que hayan sido vistos");

      }
    }
  });
}

function displayVideoAnalytics(videoId) { //ESTA FUNCION MUESTRA LOS DATOS DE LOS VIDEOS
    if (channelId) {
      // To use a different date range, modify the ONE_MONTH_IN_MILLISECONDS
      // variable to a different millisecond delta as desired.
      var today = new Date();
      var lastMonth = new Date(today.getTime() - ONE_MONTH_IN_MILLISECONDS);

      var request = gapi.client.youtubeAnalytics.reports.query({
        // The start-date and end-date parameters must be YYYY-MM-DD strings.
        'start-date': formatDateString(lastMonth),
        'end-date': formatDateString(today),
        // At this time, you need to explicitly specify channel==channelId.
        // See https://developers.google.com/youtube/analytics/v1/#ids
        ids: 'channel==' + channelId,
        dimensions: 'day',
        sort: 'day',
        // See https://developers.google.com/youtube/analytics/v1/available_reports
        // for details about the different filters and metrics you can request
        // if the "dimensions" parameter value is "day".
        metrics: 'views',
        filters: 'video==' + videoId
      });

      request.execute(function(response) {
        // This function is called regardless of whether the request succeeds.
        // The response contains YouTube Analytics data or an error message.
        if ('error' in response) {
          displayMessage(response.error.message);
        } else {
          displayChart(videoId, response);
        }
      });
    } else {
      // The currently authenticated user's channel ID is not available.
      displayMessage('The YouTube channel ID for the current user is not available.');
    }
  }

  // This boilerplate code takes a Date object and returns a YYYY-MM-DD string.
  function formatDateString(date) {
    var yyyy = date.getFullYear().toString();
    var mm = padToTwoCharacters(date.getMonth() + 1);
    var dd = padToTwoCharacters(date.getDate());

    return yyyy + '-' + mm + '-' + dd;
  }

  // If number is a single digit, prepend a '0'. Otherwise, return the number
  //  as a string.
  function padToTwoCharacters(number) {
    if (number < 10) {
      return '0' + number;
    } else {
      return number.toString();
    }
  }

  // Call the Google Chart Tools API to generate a chart of Analytics data.
  function displayChart(videoId, response) {
    if ('rows' in response) {
      hideMessage();

      // The columnHeaders property contains an array of objects representing
      // each column's title -- e.g.: [{name:"day"},{name:"views"}]
      // We need these column titles as a simple array, so we call jQuery.map()
      // to get each element's "name" property and create a new array that only
      // contains those values.
      var columns = $.map(response.columnHeaders, function(item) {
        return item.name;
      });
      // The google.visualization.arrayToDataTable() function wants an array
      // of arrays. The first element is an array of column titles, calculated
      // above as "columns". The remaining elements are arrays that each
      // represent a row of data. Fortunately, response.rows is already in
      // this format, so it can just be concatenated.
      // See https://developers.google.com/chart/interactive/docs/datatables_dataviews#arraytodatatable
      var chartDataArray = [columns].concat(response.rows);
      var chartDataTable = google.visualization.arrayToDataTable(chartDataArray);

      var chart = new google.visualization.LineChart(document.getElementById('chart'));
      chart.draw(chartDataTable, {
        // Additional options can be set if desired as described at:
        // https://developers.google.com/chart/interactive/docs/reference#visdraw
        title: 'Vistas para el id de este video ' + videoId
      });
    } else {
      displayMessage('No hay datos disponibles para este video:  ' + videoId);
    }
  }

   function displayMessage(message) {
    $('#message').text(message).show();
  }

  // This helper method hides a previously displayed message on the page.
  function hideMessage() {
    $('#message').hide();
  }


function displaychannelID(channel, channel1){ //ESTA FUNCION MUESTRA EL ID DE USUARIO Y EL CANAL
//document.write(channel);
document.getElementById("idusuario").innerHTML = channel; //TOMA EL ID "IDUSUARIO" DEL DOM (HTML) Y LE INSERTA LA VARIABLE CHANNEL
document.getElementById("subscriptores").innerHTML = channel1; //IGUAL QUE ARRIBA
//document.write(channel1);
}

})();