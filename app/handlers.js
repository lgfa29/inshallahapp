var request = require('request');
var Firebase = require('firebase');
var FirebaseTokenGenerator = require('firebase-token-generator');
var Settings = require('./settings');

var tokenGenerator = new FirebaseTokenGenerator(Settings.FIREBASE_SECRET);

var adminToken = tokenGenerator.createToken(
  { uid: "1"},
  { admin: true}
);

module.exports = {

  addStar : function(req, reply) {
    var starredUser = req.payload.useridToStar;
    var user = new Firebase(Settings.FIREBASE_DOMAIN + '/users/' + req.payload.currentUser + '/contact_sent/' + starredUser);

    var onComplete = function(error) {
      if (error) {
        console.warn('Synchronization failed');
        reply(error);
      } else {
        incrementStar(starredUser, "increase");
        reply('starred');
      }
    };

    user.authWithCustomToken(adminToken, function(error, authData) {
      if (error) {
        console.error(error);
      } else {
        user.update ({
          'star_status': 'starred'
        }, onComplete);
      }
    });
  },

  removeStar : function(req, reply) {
    var starredUser = req.payload.useridToStar;
    var user = new Firebase(Settings.FIREBASE_DOMAIN + '/users/' + req.payload.currentUser + '/contact_sent/' + starredUser);

    var onComplete = function(error) {
      if (error) {
        console.warn('Synchronization failed');
        reply(error);
      } else {
        incrementStar(starredUser, "decrease");
        reply('unstarred');
      }
    };

    user.authWithCustomToken(adminToken, function(error, authData) {
      if (error) {
        console.error(error);
      } else {
        user.update ({
          'star_status': 'unstarred'
        }, onComplete);
      }
    });
  },

  sendMessage : function(req, reply) {
    var messageInfo = req.payload;
    console.log(req.payload);

    var details = getMessageDetails(messageInfo, function(data){
      checkTextCount(data.sender, function(boolean){
        if (boolean){
          // checkContacts(data.sender, data.reciever, function(boolean){
          //   if (boolean) {
          //     console.log('contacted already');
          //     reply({success: false, message: 'You have already contacted this person, you can\'t contact them again but they have your number', arabicMessage: 'لقد سبق واتصلت بهذا الشخص، لا يمكنك الاتصال به مرة أخرى ولكن لديه رقمك'});
          //   } else {
          twilio(data, reply);
          //   }
          //});

          console.log("message will be sent");
        } else {
          console.error('too many texts');
          reply({success: false, message: 'You have sent more than five texts today. Please wait until tomorrow to send any more', arabicMessage: 'لقد أرسلت أكثر من خمسة نصوص اليوم. يرجى الانتظار حتى الغد لإرسال المزيد'});
        }
      });
    });
  },


  returnSearch : function(req, reply){
    var searchQuery = JSON.parse(req.payload);
    var searchResult = searchFunction(searchQuery, function(data){
      reply(JSON.stringify(data));
    });
  },

  saveProfile : function(req, reply){
    var profileObject = JSON.parse(req.payload).userProfile;
    var profileKey = profileObject.uid;
    var users = new Firebase(Settings.FIREBASE_DOMAIN + '/users/');
    var userProfile = users.child(profileKey);
    var token = JSON.parse(req.payload).token;

    var onComplete = function(error) {
      if (error) {
        console.warn('Synchronization failed');
        reply(error);
      } else {
        console.log('Synchronization succeeded');
        reply(200);
      }
    };

    userProfile.authWithCustomToken(token, function(error, authData) {
      if (error) {
        console.error(error);
      } else {
        userProfile.update({
         'phoneNumber' : profileObject.phoneNumber,
         'phoneCC': profileObject.phoneCC,
         'anythingElse': profileObject.anythingElse,
         'skillsNeeded': profileObject.skillsNeeded,
         'hasSkills': profileObject.hasSkills,
         'locationCity': profileObject.locationCity,
         'locationCountry': profileObject.locationCountry,
         'shareSkills': profileObject.shareSkills,
         'profileComplete': profileObject.profileComplete
       }, onComplete);
      }
    });
  },

  login : function(req, reply) {
    var userDetails = JSON.parse(req.payload);
    var token = userDetails.token;
    var user = new Firebase(Settings.FIREBASE_DOMAIN + '/users/' + userDetails.uid);
    user.authWithCustomToken(token, function(error) {
      if (error) {
        console.error(error);
      }
    });

    user.once("value", function(snapshot) {
      if (snapshot.exists() && snapshot.val().phoneNumber && snapshot.val().phoneCC) {
        reply({userProfile: snapshot.val(), userSetupComplete: true});
      } else {
        if (!snapshot.exists()) {
          createUser(userDetails, function(profile){
            reply({userProfile: profile, userSetupComplete: false});
          });

        } else {
          reply({userProfile: snapshot.val(), userSetupComplete: false});
        }
      }
    });
  },

  getLocation: function(req, reply) {
    var coords = req.payload;
    var google_maps_url = 'https://maps.googleapis.com/maps/api/geocode/json?latlng=' +
        coords.latitude + ',' + coords.longitude + '&result_type=country|locality&key=' + Settings.GOOGLE_MAPS_API_KEY;
    request(google_maps_url, function(error, response, body) {
      var data = JSON.parse(body);
      if (data.status === 'OK') {
        var city = extractCity(data.results);
        var country = extractCountry(data.results);
        reply({city: city, country: country});
      } else {
        reply('error: ', data.status);
      }
    });
  },

  getProfileDetails: function(req, reply) {
    var id = req.payload.id;
    var user = new Firebase(Settings.FIREBASE_DOMAIN + '/users/' + id);
    user.authWithCustomToken(adminToken, function(error) {
      if (error) {
        console.error(error);
      } else {
        user.once('value', function(snapshot){
          var profile = snapshot.val();
          var responseObject = {
            first_name: profile.first_name,
            last_name: profile.last_name,
            display_name: profile.display_name,
            hasSkills: profile.hasSkils,
            skillsNeeded: profile.skillsNeeded,
            shareSkills: profile.shareSkills,
            story: profile.story,
            locationCity: profile.locationCity,
            locationCountry: profile.locationCountry
          };
          reply(snapshot.val());
        }, function(error){
          reply(error);
        });
      }
    });
  },

  getSettings: function (req, reply) {
    // we don't want to supply all settings as some are confidential
    var s = {
      FIREBASE_DOMAIN: Settings.FIREBASE_DOMAIN,
      FIREBASE_STORAGE_KEY: Settings.FIREBASE_STORAGE_KEY
    };
    reply('var Settings = ' + JSON.stringify(s) + ';').type('application/javascript');
  }
};

function createUser(user, callback) {
  var users = new Firebase(Settings.FIREBASE_DOMAIN + '/users/');
  var newUser = {};
  newUser[user.uid] = {first_name: user.facebook.cachedUserProfile.first_name, last_name: user.facebook.cachedUserProfile.last_name, display_name: user.facebook.displayName, star_count: 0};
  users.update(newUser);
  callback(newUser[user.uid]);
}


function searchFunction(searchObject, callback) {
  var users = new Firebase(Settings.FIREBASE_DOMAIN + '/users/');
  var searchTerms = searchObject;

  users.authWithCustomToken(adminToken, function(error) {
    if (error) {
      console.log(error);
    } else {
      users.once("value", function(snapshot) {
        var data = snapshot.val();
        var answer = searchUsers(data, searchTerms);
        return callback(answer);

      }, function (errorObject) {
        console.log("The read failed: " + errorObject.code);
      });
    }
  });
}

function searchUsers(data, terms) {

  var keysArray = Object.keys(data);
  var searchResults = [];
  var searchLocationMatch = [];

  if(terms.searchChoice === "takeHelp"){

    keysArray.forEach(function(key){
      var hasSkills = data[key].hasSkills || [];
      var theirLocation = data[key].locationCountry || [];

      if (hasSkills.indexOf(terms.searchTopic) > -1 && key != terms.uid) {
        var result = {};
        result[key] = data[key];

        if (theirLocation.indexOf(terms.searchLocation) > -1) {
          searchLocationMatch.push(result);
        } else {
          searchResults.push(result);
        }
      }


    });

  } else if (terms.searchChoice === "giveHelp"){
    keysArray.forEach(function(key){
      var skillsNeeded = data[key].skillsNeeded || [];
      var theirLocation = data[key].locationCountry || [];

      if (skillsNeeded.indexOf(terms.searchTopic) > -1 && key != terms.uid) {
        var result = {};
        result[key] = data[key];

        if (theirLocation.indexOf(terms.searchLocation) > -1) {
          searchLocationMatch.push(result);
        } else {
          searchResults.push(result);
        }
      }
    });
  } else {
    console.log('error');
  }

  var fullResults = searchLocationMatch.concat(searchResults);
  return fullResults;
}


function extractCity(data) {
  var found;
  data.forEach(function(el){
    if (el.types.indexOf("locality") > -1) {
      found = el.address_components[0].long_name;
    }
  });
  return found;
}

function extractCountry(data) {
  var found;
  data.forEach(function(el){
    if (el.types.indexOf("country") > -1) {
      found = el.address_components[0].long_name;
    }
  });
  return found;
}

function getMessageDetails(messageInfo, callback) {
  var users = new Firebase(Settings.FIREBASE_DOMAIN + '/users/');
  var messageDetails = {};

  users.authWithCustomToken(adminToken, function(error) {
    if (error) {
      console.log(error);
    } else {
      users.once("value", function(snapshot) {
        var data = snapshot.val();

        if (messageInfo.reciever === "inshallahGeneric") {
          messageDetails.reciever = "inshallahGeneric";
          messageDetails.reciever.uid = "insh";
        } else {
          messageDetails.reciever = data[ messageInfo.reciever];
          messageDetails.reciever.uid =  messageInfo.reciever;
        }
        messageDetails.sender = data[messageInfo.sender];
        messageDetails.sender.uid = messageInfo.sender;
        messageDetails.searchLocation = messageInfo.searchLocation;
        messageDetails.searchChoice = messageInfo.searchChoice;
        messageDetails.searchTopic = messageInfo.searchTopic;

        callback(messageDetails);
      }, function (errorObject) {
        console.error("The read failed: " + errorObject.code);
      });
    }
  });
}

function twilio(messageDetails, reply) {
  var messageBody;

  if (messageDetails.reciever === "inshallahGeneric") {
    messageBody = "No results in search, " + messageDetails.sender.first_name + " wants to " + messageDetails.searchChoice + " with " + messageDetails.searchTopic + " in " + messageDetails.searchLocation + ". Their number is " + messageDetails.sender.phoneCC + messageDetails.sender.phoneNumber + ". Their link is www.inshallahapp.com/main#profile?id=" + messageDetails.sender.uid;
  } else {
    messageBody = messageDetails.sender.first_name + " wants to " + messageDetails.searchChoice + " with " + messageDetails.searchTopic + " in " + messageDetails.searchLocation + ". They clicked on " + messageDetails.reciever.display_name + " whose number is " + messageDetails.reciever.phoneCC + messageDetails.reciever.phoneNumber + ". The sender number is " +
     messageDetails.sender.phoneCC + messageDetails.sender.phoneNumber + ". Their link is www.inshallahapp.com/main#profile?id=" + messageDetails.sender.uid;
  }

  // if (messageDetails.searchChoice == "takeHelp"){
  //   messageBody = "Hello " + messageDetails.reciever.first_name + ", " + messageDetails.sender.first_name + " needs help with " + messageDetails.searchTopic + ". Get in touch with them at the number below or see their Inshallah page at the link below. "
  //   messageBody += "مرحبا " + messageDetails.reciever.first_name + "،" + messageDetails.sender.first_name + "يحتاج إلى مساعدة مع " + messageDetails.searchTopic + " يمكنك الاتصال على " + messageDetails.sender.phoneCC + messageDetails.sender.phoneNumber + " أو راجع الصفحة من هنا :  Inshallah.herokuapp.com/main#profile?id=" + messageDetails.sender.uid;
  // } else if (messageDetails.searchChoice == "giveHelp") {
  //
  //   messageBody = "Hello " + messageDetails.reciever.first_name + ", " + messageDetails.sender.first_name + " can help you with " + messageDetails.searchTopic + ". Get in touch with them at the number below or see their Inshallah page at the link below. "
  //   messageBody += "مرحبا " + messageDetails.reciever.first_name + "،" + messageDetails.sender.first_name + " يستطيع مساعدتك ب " + messageDetails.searchTopic + "يمكنك الاتصال على " + messageDetails.sender.phoneCC + messageDetails.sender.phoneNumber + " أو راجع الصفحة   من هنا : Inshallah.herokuapp.com/main#profile?id=" + messageDetails.sender.uid;
  // } else {
  //   console.error('error');
  // }


  var accountSid = Settings.TWILIO_ACCOUNT_SID;
  var authToken = Settings.TWILIO_AUTH_TOKEN;
  var twilioPhoneNumber = Settings.TWILIO_PHONE_NUMBER;
  var inshallahPhoneNumber = Settings.INSHALLAH_PHONE_NUMBER;

  var client = require('twilio')(accountSid, authToken);

  client.messages.create({
      to: inshallahPhoneNumber,
      from: twilioPhoneNumber,
      body: messageBody,
  }, function(err, message) {
    if (err) {
      console.error(err);
      reply({success: false, message: 'Something went wrong, please try again later', arabicMessage: ''});
    } else {
      //addContact('contact_sent', messageDetails.sender.uid, {uid: messageDetails.reciever.uid, name: messageDetails.reciever.display_name, star_status: 'unstarred'});
      //addContact('contact_recieved', messageDetails.reciever.uid, {uid: messageDetails.sender.uid, name: messageDetails.sender.display_name, tel: messageDetails.sender.phoneCC + messageDetails.sender.phoneNumber, star_status: 'unstarred'});

      incrementTextCount(messageDetails.sender);
      //incrementContactedCount(messageDetails.reciever);
      reply({success: true, message: 'Message Sent!', arabicMessage: ''});
      console.log("message sent");
      //contact: {name: messageDetails.reciever.display_name, uid: messageDetails.reciever.uid};
    }
  });
}


function checkContacts(sender, reciever, callback) {
  var user = new Firebase(Settings.FIREBASE_DOMAIN + '/users/' + sender.uid + '/' + 'contact_sent');

  user.once("value", function(snapshot){
    var contacts = snapshot.val();
    for (var key in contacts) {
      if (contacts[key].uid === reciever.uid) {
        return callback(true);
      }
    }
    callback(false);
  });
}

function checkTextCount(sender, callback) {
  var newObj = {};
  var user = new Firebase(Settings.FIREBASE_DOMAIN + '/users/' + sender.uid + '/text_count');

  var dateString = getCurrentDate();

  user.once("value", function(snapshot){
    var textCount;
    if (snapshot.val()){
      textCount = snapshot.val()[dateString];
    }

    if (textCount && textCount < 5) {
      callback(true);
    } else if (textCount >= 5) {
      callback(false);
    } else if (!textCount){
      newObj[dateString] = 0;
      user.set(newObj);
      callback(true);
    }
  });
}

function incrementTextCount(sender) {
  var user = new Firebase(Settings.FIREBASE_DOMAIN + '/users/' + sender.uid + '/text_count');
  var newObj = {};
  var dateString = getCurrentDate();

  user.once("value", function(snapshot){
    var textCount = snapshot.val()[dateString];
    newObj[dateString] = textCount + 1;
    user.update(newObj);
  });
}

function addContact(contactKey, userid, contactObject) {
  var user = new Firebase(Settings.FIREBASE_DOMAIN + '/users/' + userid + '/' + contactKey + '/' + contactObject.uid);

  user.authWithCustomToken(adminToken, function(error) {
    if (error) {
      console.error(error);
    } else {
      user.set(contactObject);
    }
  });
}

function incrementContactedCount(reciever) {
  var user = new Firebase(Settings.FIREBASE_DOMAIN + '/users/' + reciever.uid);

  user.once("value", function(snapshot){
    var contacted_count = snapshot.val().contacted_count;
    if (contacted_count) {
      var contactedCount = contacted_count + 1;
      user.update({
        "contacted_count": contactedCount
      });
    } else {
      user.update({
        "contacted_count": 1
      });
    }
  });
}


function getCurrentDate(){
  var today = new Date(Date.now());

  var day = today.getDate();
  var month = today.getMonth();
  var year = today.getFullYear();

  var dateString = year + '-' + month + '-' + day;

  return dateString;
}

function incrementStar(userid, increment) {
  var user = new Firebase(Settings.FIREBASE_DOMAIN + '/users/' + userid);

  user.authWithCustomToken(adminToken, function(error) {
    if (error) {
      console.error(error);
    } else {
      user.once("value", function(snapshot){
        var currentCount = snapshot.val().star_count;

        if (increment === "increase") {
          currentCount = currentCount + 1;
          user.update({
            "star_count": currentCount
          });
        } else if (increment === "decrease") {
          if (currentCount !== 0) {
            currentCount = currentCount -1;
            user.update({
              "star_count": currentCount
            });
          } else {
            currentCount = 0;
            user.update({
              "star_count": currentCount
            });
          }
        }
      });
    }
  });
}
