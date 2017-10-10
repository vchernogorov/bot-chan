const Discord = require("discord.js");
const client = new Discord.Client();
var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');

// FILL THESE OUT
const sos_id = "";
const test_id = "";
const bot_admin_id = ;
// number of messages to collect for corpus 
// depends on how many messages you have in your particular server
const message_count = 60000; 
// collect messages before this message 
// set this as the last message before the bot was introduced to channel
// (to avoid discussions about the bot getting into the corpus
const boundary_message = ; 
const your_bot_token = "";


var sos;
var test;
const eof = "!!end!!";

// messages
var ramble_min = 100;
var ramble_max = 300;
// milliseconds
var response_min = 80000;
var response_max = 170000;

const intercation_cap_reset_interval = 60000;
const interaction_max = 3;




var corpus = [];


client.on("ready", () => {
	console.log("I am ready!");

	sos = client.channels.get(sos_id);
	test = client.channels.get(test_id);
	test.send("I'm ready.");
});

// TODO
// update googlesheets data every once in a while?

var next_msg = 10;
var ready_to_markov = false;
var response_cd = false;
var just_said_goodnight = false;
var ready_to_markov = false;

function reset_response_cd() {
	response_cd = false;
}
function reset_goodnight() {
	just_said_goodnight = false;
}
function delayed_response() {
	sos.send(random_many_words());
}
function do_remind(user, text) {
	user.send(text);
}
var interaction_caps = {};
function reset_interaction_caps() {
	interaction_caps = {};
	setTimeout(reset_interaction_caps, intercation_cap_reset_interval);
}
reset_interaction_caps();

var ignored = [
239826319989407744,
225655862079913984,
]

const goodnight_strings = [
"Good night ",
"Sleep well ",
"Sweet dreams ", 
"See you ", 
];


client.on("message", (message) => {
	if(message.author.bot) return;
	if(ignored.includes(message.author.id)) return;

	var content = message.content.substring(0, 100);

	if (message.author.id == bot_admin_id) {
		if (content.match("!collect corpus")) {
			console.log("Collecting corpus");
			fetch_many_messages(sos, message_count);
		} else if (content.match("!export corpus")) {
			console.log("Exporting corpus");
			fs.writeFile('corpus.txt', corpus.join('\n'), (err) => {
				if (err) throw err;
				console.log('Exported corpus');
			});
		} else if (content.match("!import corpus")) {
			console.log("Importing corpus");
			fs.exists('corpus.txt', (exists) => {
				if (exists) {
					fs.readFile('corpus.txt', 'utf8', (err, corpus_string) => {
						console.log('Imported corpus');
						corpus = corpus_string.split('\n');
					});
				} else {
					console.log("No corpus.txt found");
				}
			});
		} else if (content.match("!read corpus")) {
			ready_to_markov = false;
			console.log("Reading corpus");
			read_corpus();
			console.log("Corpus was read");
			ready_to_markov = true;
		} else if (content.match("!markov") && ready_to_markov) {
			test.send(random_many_words());
		} else if (content.startsWith("!send sos ")) {
			sos.send(content.replace("!send sos ", ""));
		} else if (content.startsWith("!rambleless")) {
			ramble_min *= 2;
			ramble_max *= 2;
			test.send("Rambling less, min = " + ramble_min + " max = " + ramble_max);
			response_cd = 0;
		} else if (content.startsWith("!ramble more")) {
			ramble_min /= 2;
			ramble_max /= 2;
			test.send("Rambling more, min = " + ramble_min + " max = " + ramble_max);
			response_cd = 0;
		} else if (content.startsWith("!respond less")) {
			response_min *= 2;
			response_max *= 2;
			test.send("Responding less, min = " + response_min + " max = " + response_max);
			response_cd = 0;
		} else if (content.startsWith("!respond more")) {
			response_min /= 2;
			response_max /= 2;
			test.send("Responding more, min = " + response_min + " max = " + response_max);
			response_cd = 0;
		} else if (content.startsWith("!ignore")) {
			if (content == "!ignore") {
				message.channel.send("!ignore (user's id)");
			} else {
				var message_split = content.split(' ');
				ignored.push(message_split[1]);
				message.channel.send("Ignoring user: " + message_split[1]);
			}
		} else if (content.startsWith("!unignore")) {
			if (content == "!unignore") {
				message.channel.send("!unignore (user's id)");
			} else {
				var message_split = content.split(' ');
				var index = ignored.indexOf(message_split[1]);
				if (index > -1) {
					ignored.splice(index, 1);
				}
				message.channel.send("Ungnoring user: " + message_split[1]);
			}
		}
	}

	if (!(message.author.id in interaction_caps)) {
		interaction_caps[message.author.id] = 0;
	} else {
		if (interaction_caps[message.author.id] >= interaction_max) {
			return;
		} else {
			interaction_caps[message.author.id] = interaction_caps[message.author.id] + 1;
		}
	}

	if (!just_said_goodnight 
		&& content.match(/(goodnight|Goodnight|Good night|good night|gonna sleep|Gonna sleep|going to sleep|Going to sleep)/))
	{
		var k = random_int(0, goodnight_strings.length - 1);
		message.channel.send(goodnight_strings[k] + message.author.username);
		just_said_goodnight = true;
		setTimeout(reset_goodnight, 60000);
	} else if (content.match("smile") && message.author.username.match("Smiles")) {
		message.channel.send("*smiles at " + message.author.username + "*");
	} else if (content.startsWith("!attendance")) {
		var name = content.replace("!attendance ", "");
		if (!(name.toLowerCase() in attendance)) {
			message.channel.send("No such name (" + name + ") exists in the attendance sheet.");
		} else {
			message.channel.send(name + " has " + attendance[name.toLowerCase()] + "% attendance and has attended " + total_days[name.toLowerCase()] + " days total.");
		}
	} else if (content.match("!remindme")) {
		if (content == "!remindme") {
			message.channel.send("!remindme (time in minutes) (message text)");
		} else {
			var message_split = content.split(' ');
			if (message_split.length > 3 && !isNaN(message_split[1])) {
				var time = message_split[1];
				if (time > 1440) {
					message.channel.send("Dude, this is too long, try something lower than 24 hours.");
				} else {
					var text = content.replace(message_split[1] + " " + message_split[1] + " ", "");
					setTimeout(do_remind, time * 60 * 1000, message.author, text);
				}
			} else {
				message.channel.send("!remindme (time in minutes) (message text)");
			}
		}
	} else if (content.match("!link") && links.length != 0) {
		message.channel.send(random_link());
	} else if (content.match("!img") && images.length != 0) {
		message.channel.send(random_image());
	} else if (content.startsWith("I love you, Bot-chan!")) {
		message.channel.send("I love you too!");
	} else if (content.match(/Bot|bot/) && content.match("kissu")) {
		message.channel.send("*gives " + message.author.username + " a kissu*");
	} else if (content.match(/Bot|bot/) && content.match(" ears")) {
		message.channel.send("*massages " + message.author.username + "'s ears*");
	} else if (content.match(/Bot|bot/) && content.match("morning")) {
		message.channel.send("Hi, " + message.author.username);
	} else if (content.match(/ohayou|Ohayou/)) {
		message.channel.send("Hi, " + message.author.username);
	} else if (ready_to_markov) {
		// reply sometimes, reply more often when ppl talk about the bot
		next_msg--;

		if (!response_cd && 
			(content.match("bot-chan") || content.match("Bot-chan"))) 
		{
			setTimeout(delayed_response, random_int(800, 2000));
			response_cd = true;
			// Sometimes double interval
			if (random_int(0, 100) > 80) {
				setTimeout(reset_response_cd, random_int(response_min * 2, response_max * 2));
			} else {
				setTimeout(reset_response_cd, random_int(response_min, response_max));
			}
		} else if (next_msg < 0) {
			setTimeout(delayed_response, random_int(2000, 10000));
			next_msg = random_int(ramble_min, ramble_max);
		}
	}
});

// inclusive both sides
function random_int(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}


function random_link() {
	var k = random_int(0, links.length - 1);
	return links[k];
}

function random_image() {
	var k = random_int(0, images.length - 1);
	return images[k];
}

function random_word(struct) {
	var total = struct.word_counts_incremented[struct.word_counts_incremented.length - 1];
	var k = random_int(0, total);
	for (var i = 0; i < struct.words.length; i++) {
		if (k <= struct.word_counts_incremented[i]) {
			return struct.words[i];
		}
	}
}

function random_many_words() {
	var str = "";

	var first_pair = random_word(firsts);
	while (!(first_pair in pairs) || pairs[first_pair].words.length == 0) {
		first_pair = random_word(firsts);
	}

	var count = 2;
	str += first_pair;

	var split_pair = first_pair.split(' ');
	var prev_prev = split_pair[0];
	var prev = split_pair[1];
	var k = random_int(10, 20);
	while (k > 0) {
		var pair = prev_prev + " " + prev;
		var next = "";
		if (pair in pairs) {
			var next = random_word(pairs[pair]);
			// console.log(next);
			count++;
		}
		str += " " + next;


		prev_prev = prev;
		prev = next;
		if (!(pair in pairs) || next == eof) {
			break;
		}
		k--;
	}

	return str;
}

function count_word(word, struct) {
	if (!(word in struct.word_map)) {
		struct.words.push(word);
		struct.word_map[word] = struct.words.length - 1;
		struct.word_counts[struct.words.length - 1] = 1;
	} else {
		var index = struct.word_map[word];
		struct.word_counts[index] = struct.word_counts[index] + 1;
	}
}

function add_up_increments(struct) {
	var total = 0;
	for (var i = 0; i < struct.words.length; i++) {
		total += struct.word_counts[i];
		struct.word_counts_incremented[i] = total;
	}
}


var firsts = {
	words : [],
	word_map : {},
	word_counts : [],
	word_counts_incremented : [],
	word_chances : [],
};

var pairs = {};
var pairs_words = [];
var pairs_word_map = {};

var links = [];
var images = [];

function read_corpus() {
	// Clear data from previous corpus
	firsts = {
		words : [],
		word_map : {},
		word_counts : [],
		word_counts_incremented : [],
		word_chances : [],
	};
	pairs = {};
	pairs_words = [];
	pairs_word_map = {};

	links = [];
	images = [];


	// Set up firsts words
	for (var i = 0; i < corpus.length; i++) {
		var content = corpus[i];
		var split_content = content.toString().split(' ');

		if (split_content.length >= 4) {
			count_word(split_content[0] + " " + split_content[1], firsts);
		} 
	}

	add_up_increments(firsts);

	// Set up pairs
	for (var i = 0; i < corpus.length; i++) {
		var content = corpus[i];
		var split_content = content.toString().split(' ');

		if (split_content.length > 2) {
			var j = 0;
			while (j < split_content.length - 2) {
				var first_word = split_content[j];
				var second_word = split_content[j + 1];
				var next_word;
				if (j + 2 == split_content.length) {
					next_word = eof;
				} else {
					next_word = split_content[j + 2];
				}
				var pair = first_word + " " + second_word;

				if (!(pair in pairs_word_map)) {
					pairs[pair] = {
						words : [],
						word_map : {},
						word_counts : [],
						word_counts_incremented : [],
						word_chances : [],
					};
					pairs_words.push(pair);
					pairs_word_map[pair] = pairs_words.length - 1;
				}
				if (next_word != second_word && next_word != first_word) {
					count_word(next_word, pairs[pair]);
				}
				j++;
			}
		}
	}
	for (var i = 0; i < pairs_words.length; i++) {
		add_up_increments(pairs[pairs_words[i]]);
	}



	// Save links
	for (var i = 0; i < corpus.length; i++) {
		var content = corpus[i];
		var split_content = content.toString().split(' ');
		if (split_content[0].match("http") && !links.includes(split_content[0])) {
			links.push(split_content[0]);
		}
	}

	// Save images
	for (var i = 0; i < corpus.length; i++) {
		var content = corpus[i];
		var split_content = content.toString().split(' ');
		if (split_content[0].match("http") 
			&& (split_content[0].match("png") || split_content[0].match("jpg") || split_content[0].match("jpeg"))
			&& !images.includes(split_content[0]))
		{
			images.push(split_content[0]);
		}
	}
}




const step = 100;

function fetch_many_messages(channel, lim) {
	channel.fetchMessages({limit: step, before: boundary_message}).then(messages => fetch_many_messagesR(channel, lim - step, messages));
}
function fetch_many_messagesR(channel, lim, messages) {
	corpus = corpus.concat(messages.array());

	if (lim % 1000 == 0) {
		console.log(lim);
	}

	if (lim <= 0) {
		console.log("Collected corpus");
		return;
	} else {
		channel.fetchMessages({limit: step, before: messages.last().id}).then(messages => fetch_many_messagesR(channel, lim - step, messages));
	}
}


client.on('guildMemberAdd', (member) => {
	// console.log("guildMemberAdd " + member.username);
	// member.send(
	// 	`Hello, welcome to SOS discord! Here are a couple useful links:

	// 	Sing-up sheet for raids
	// 	https://docs.google.com/spreadsheets/d/1tWjtVFbbxR6B6cR7RyBcz6NIy_43pv96efyvyNf7rRc/edit#gid=91831250
	// 	This is where you sign up for raids. If you're planning to actively raid with us, make sure to sign up because otherwise spots are not guaranteed! Also, if you scroll down, you will see the NOT ATTENDING part of the sheet. This part is also important and you should try to sign this if you can't come. You can also give a reason in the Note field(below your name) -  work, family trip, travel is good.

	// 	Guild spreadsheet
	// 	https://docs.google.com/spreadsheets/d/16FZ1PEXk5KmyMU87WhVeGiaZ-aiBvloZ5X3yBJ4gpxM/edit
	// 	This spreadsheet has a lot of info! The most important pages are Mandatory Raid Addons(which you should install), class guides and Crafters, which tells you who can craft what in the guild.


	// 	If you want to find the signup sheet later, check out the #raid_signups channel. It's usually posted there. Guild spreadsheet is located in #links channel. That channel also has other useful links. There is also a #class-guides channel which has all of the class guides/consumable guides/bis gear lists in one place.
	// 	`);
})



client.login(your_bot_token);









// ------------------------------------------------------------
//						 GOOGLE API
// ------------------------------------------------------------
var attendance = {};
var total_days = {};

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/sheets.googleapis.com-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
	process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'sheets.googleapis.com-nodejs-quickstart.json';

// Load client secrets from a local file.
fs.readFile('client_secret.json', function processClientSecrets(err, content) {
	if (err) {
		console.log('Error loading client secret file: ' + err);
		return;
	}
  // Authorize a client with the loaded credentials, then call the
  // Google Sheets API.
  authorize(JSON.parse(content), retrieve_attendance);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
 function authorize(credentials, callback) {
 	var clientSecret = credentials.installed.client_secret;
 	var clientId = credentials.installed.client_id;
 	var redirectUrl = credentials.installed.redirect_uris[0];
 	var auth = new googleAuth();
 	var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function(err, token) {
  	if (err) {
  		getNewToken(oauth2Client, callback);
  	} else {
  		oauth2Client.credentials = JSON.parse(token);
  		callback(oauth2Client);
  	}
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
 function getNewToken(oauth2Client, callback) {
 	var authUrl = oauth2Client.generateAuthUrl({
 		access_type: 'offline',
 		scope: SCOPES
 	});
 	console.log('Authorize this app by visiting this url: ', authUrl);
 	var rl = readline.createInterface({
 		input: process.stdin,
 		output: process.stdout
 	});
 	rl.question('Enter the code from that page here: ', function(code) {
 		rl.close();
 		oauth2Client.getToken(code, function(err, token) {
 			if (err) {
 				console.log('Error while trying to retrieve access token', err);
 				return;
 			}
 			oauth2Client.credentials = token;
 			storeToken(token);
 			callback(oauth2Client);
 		});
 	});
 }

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
 function storeToken(token) {
 	try {
 		fs.mkdirSync(TOKEN_DIR);
 	} catch (err) {
 		if (err.code != 'EEXIST') {
 			throw err;
 		}
 	}
 	fs.writeFile(TOKEN_PATH, JSON.stringify(token));
 	console.log('Token stored to ' + TOKEN_PATH);
 }

 function retrieve_attendance(auth) {
 	var sheets = google.sheets('v4');
 	sheets.spreadsheets.values.get({
 		auth: auth,
 		spreadsheetId: '1Zv2OGZxi0bLywVuOlVatso8wmVJ6Lfjp7TdX1Zmt8fc',
 		range: 'Raider stats!A1:E72',
 	}, function(err, response) {
 		if (err) {
 			console.log('The API returned an error: ' + err);
 			return;
 		}
 		var rows = response.values;
 		if (rows.length == 0) {
 			console.log('No data found.');
 		} else {
 			for (var i = 0; i < rows.length; i++) {
 				var row = rows[i];

 				if (row[0] != undefined) {
 					total_days[row[0].toLowerCase()] = row[3];
 					attendance[row[0].toLowerCase()] = row[4];
 				}
 			}

 			console.log("Attendance data loaded");
 		}
 	});
 }


