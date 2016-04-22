var arabicSkills = {
  'Accommodation': 'سكن',
  'Advice': 'إستشارة',
  'Arabic Lessons': 'دروس عربي',
  'Asylum System': 'نظام اللجوء',
  'Border Updates': 'آخر تطورات الحدود',
  'Child Support': 'دعم الطفل',
  'English Lessons': 'دروس انجليزي',
  'Emotional Support': 'دعم ذهني',
  'Financial Advice': 'إستشارة مالية',
  'Form Filling': 'مساعدة الآدمن',
  'Friendship': 'صداقة',
  'Jobs': 'أعمال',
  'Legal Help': 'مساعدة قانونية',
  'Medical Care': 'عناية طبية',
  'Mentoring': 'التوجيه',
  'Psychologist': 'معالج نفسي',
  'Studying': 'دراسة',
  'Translation': 'ترجمات',
};
var nonDigit = new RegExp(/[^0-9]/, 'g');
var leadingZero = new RegExp(/\b0+/, 'g');

// -- Initialise App -- //

$(document).ready(function(){
  if (!localStorage.getItem('firebase:session::blazing-torch-7074') && !state.authData){
    window.location.href = '/';
  }
  state = JSON.parse(localStorage.getItem('state')) || state;
  renderProfile();
  renderActivity();
});

function renderProfile(){
  var profile = JSON.parse(localStorage.getItem('firebase:session::blazing-torch-7074'));

  $('.first-name').html(profile.facebook.cachedUserProfile.first_name);

  state.userProfile.skillsNeeded.map(function(el){
    displaySkill('.need-skill-box', el, 'skillsNeeded');
  });

  state.userProfile.hasSkills.map(function(el){
    displaySkill('.have-skill-box', el, 'hasSkills');
  });

  $('#country-code').val(state.userProfile.phoneCC);
  $('#tel').val(state.userProfile.phoneNumber);

  $('#locationCity').val(state.userProfile.locationCity);
  $('#locationCountry').val(state.userProfile.locationCountry);

  $('#share-skills').val(state.userProfile.shareSkills);
  $('#anything-else').val(state.userProfile.anythingElse);
}

// -- Sending Data to Database From Signup/Update Profile -- //

$('#save-button').on('click', function(){
  state.userProfile.phoneNumber = validatePhone();
  state.userProfile.phoneCC = validatePhoneCC();
  if (state.userProfile.phoneNumber && state.userProfile.phoneCC){
    saveProfile();
  } else {
    showWarning();
  }
});

function saveProfile() {
  var authData = JSON.parse(localStorage.getItem('firebase:session::blazing-torch-7074'));
  var currentUid = authData.uid;

  state.userProfile.locationCity = sanitise($('#locationCity').val()) || '';
  state.userProfile.locationCountry = sanitise($('#locationCountry').val()) || 'Anywhere';

  state.userProfile.shareSkills = sanitise($('#share-skills').val());
  state.userProfile.anythingElse = sanitise($('#anything-else').val());

  var authToken = authData.token;

  var updateUser = {
    'uid' : currentUid,
    'phoneNumber' : state.userProfile.phoneNumber,
    'phoneCC': state.userProfile.phoneCC,
    'story' : state.userProfile.story,
    'skillsNeeded': state.userProfile.skillsNeeded,
    'hasSkills': state.userProfile.hasSkills,
    'locationCity': state.userProfile.locationCity,
    'locationCountry': state.userProfile.locationCountry,
    'shareSkills': state.userProfile.shareSkills,
    'anythingElse': state.userProfile.anythingElse,
  };

  localStorage.setItem('state', JSON.stringify(state));

  var request = new XMLHttpRequest();
  request.open('POST', '/saveProfile');
  request.send(JSON.stringify({token: authToken, userProfile: updateUser}));

  request.onreadystatechange = function(){
    if (request.readyState === 4) {
      if (request.status === 200) {
        window.location.href = '/main#search';
        console.log('search');
      } else {
        console.log('error, in search');
      }
    }
  };
}

// -- Validation Functions -- //

function validatePhone() {
  var phoneNum = $('#tel').val();
  var digits = phoneNum.replace(nonDigit, '').replace(leadingZero, '');
  if (digits.length < 10 || digits.length > 15) {
    return '';
  } else {
    return digits;
  }
}

function validatePhoneCC() {
  var countryCode = $('#country-code').val();
  var countryDigits = countryCode.replace(nonDigit, '').replace(leadingZero, '');
  return '+' + countryDigits;
}

function showWarning() {
  $( "#phoneAlert" ).popup();
  $( "#phoneAlert" ).popup( "open" );
}

function sanitise(input) {
  if ( input.match("<") || input.match(">") ) {
    cleanText = input.replace(/\</g, "&lt;").replace(/\>/g, "&gt;");
    return cleanText;
  }
  return input;
}

// -- Skills box functions -- //

$('.select').on('change',function(e){
  if ($(this).hasClass('need-skill-select')) {
    addSkill(e, 'skillsNeeded', '.need-skill-box');
  } else if ($(this).hasClass('have-skill-select')) {
    addSkill(e, 'hasSkills', '.have-skill-box');
  }
});

function deleteSkill(e, skill, skillsArray) {
  $(e.target.parentElement).remove();
  skillsArray.splice(skillsArray.indexOf(skill), 1);
}

function addSkill(e, skillsArray, box) {
  var skill = $(e.target).val();
  if (state.userProfile[skillsArray].indexOf(skill) === -1 && state.userProfile[skillsArray].length < 5) {
    state.userProfile[skillsArray].push(skill);
    displaySkill(box, skill, skillsArray);
  }
}

function displaySkill(box, skill, skillsArray){
  $(box).append('<div class="skill"><a href="#" id=' + skill + '-' + skillsArray + ' class="delete-skill ui-btn ui-shadow ui-corner-all ui-icon-delete ui-btn-icon-notext ui-btn-b ui-btn-inline">Delete</a>' + skill + ' / ' + arabicSkills[skill] + '</div>');
  $('#' + skill + '-' + skillsArray).on('click', function(ev){
    deleteSkill(ev, skill, state.userProfile[skillsArray]);
  });
}

// -- Location -- //

$('.getLocation').on('click', function(e){
  if (!navigator.geolocation) {
    $( "#geoUnavailable" ).popup();
    $( "#geoUnavailable" ).popup( "open" );
  }

  navigator.geolocation.getCurrentPosition(function(position){
    var latitude = position.coords.latitude;
    var longitude = position.coords.longitude;
    $.post('/location', {latitude: latitude, longitude: longitude}, function(data){
      var locCity = $('#locationCity');
      var locCountry = $('#locationCountry');
      var city = data.city;
      var country = data.country;
      if (data.city && data.country) {
        locationCity = data.city;
        locationCountry = data.country;
      } else if (data.country) {
        locationCountry = data.country;
        locationCity = '';
      } else {
        locationCountry = 'Anywhere';
        locationCity = '';
      }
      locCity.val(locationCity);
      locCountry.val(locationCountry);
    });
  }, function(error){
    if (error.code === 1) {
      $( "#geoDenied" ).popup();
      $( "#geoDenied" ).popup( "open" );
    } else {
      $( "#geoError" ).popup();
      $( "#geoError" ).popup( "open" );
    }
  });
});

// -- Header Menu -- //

var menu = {
  html: '<div class="modal"><div class="links"><ul><a href="/main"><li>My INshallah Page / صفحتي الشخصية</li></a><a href="#search"><li>Search / بحث</li></a><a href="#activity"><li>My Activity / نشاطي</li></a><a href="#information"><li>Information / معومات</li></a><a href="https://docs.google.com/forms/d/16EC6IcvYIWvaEvRRHBZYlpaMbo6eLCl4Dud3miyoZE0/viewform"><li>Contact INshallah / اتصل بنا</li></a></ul></div></div>',
  visible: false,
};

$('.hamburger').on('click', function(){
  toggleMenu();
});

function toggleMenu() {
  if (menu.visible) {
    $('.modal').remove();
    menu.visible = false;
  } else {
    $('body').prepend(menu.html);
    $('.modal, .links ul a').on('click', function(){
      toggleMenu();
    });
    menu.visible = true;
  }
}

// -- Activity Page -- //

function renderActivity() {
    state.contacted = [];
    state.receivedContact = [];
    console.log(state.userProfile);
  for (var key in state.userProfile.contact_sent) {
    state.contacted.push(state.userProfile.contact_sent[key]);
    console.log("contacted", state.contacted);
  }


  for (var item in state.userProfile.contact_recieved) {
    state.receivedContact.push(state.userProfile.contact_recieved[item]);
    console.log("recieved", state.receivedContact);
  }

  $('.sent').append(state.contacted.map(function(el){
    var starClass = checkStar(el);

    return (
      '<div class="activity-individual"><a class="profile-link" href="#profile?id=' + el.uid + '"><div>' + el.name + '</div></a><div><button class="star ' + starClass + '">Star</button></div></div>'
    );
  }));

  $('.received').append(state.receivedContact.map(function(el){
    var starClass = checkStar(el);

    return (
      '<div class="activity-individual"><a class="profile-link" href="#profile?id=' + el.uid + '"><div>' + el.name + '</div></a><div><button class="star ' + starClass + '">Star</button></div></div>'
    );
  }));

  $('.sent-nav').on('click', function(){
    $('.sent').removeClass('hidden');
    $('.received').addClass('hidden');
  });

  $('.received-nav').on('click', function(){
    $('.received').removeClass('hidden');
    $('.sent').addClass('hidden');
  });
}

//Star function

$('.activity').on('click', '.star', function(e){
    var currentUser = JSON.parse(localStorage.getItem('firebase:session::blazing-torch-7074'));
    var currentid = currentUser.uid;
    console.log('current id', currentid);

    var userStarred = e.target;
    var activityIndividual = $(userStarred).parent()[0].parentElement;
    var link = $(activityIndividual).find('a:first').attr('href');
    var useridToStar = link.split('id=')[1];

    console.log("user to star", useridToStar);

    if ($(userStarred).hasClass('starred')) {
      $.post('/removeStar', {'currentUser' : currentid, 'useridToStar': useridToStar}, function(data){
        if (data === 'unstarred'){
          $(userStarred).removeClass('starred');
          $(userStarred).addClass('unstarred');
       console.log('star removed', userStarred);
        }
      });

    } else {
      $.post('/addStar', {'currentUser' : currentid,'useridToStar': useridToStar}, function(data){
        if (data === 'starred'){
          $(userStarred).addClass('starred');
          $(userStarred).removeClass('unstarred');
          console.log('star added', userStarred);
        }
      });
    }
  });

function checkStar(el) {
  if (el.star_status === "unstarred") {
    return "unstarred";
  } else {
    return "starred";
  }
}
