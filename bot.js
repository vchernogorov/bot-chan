// TODO

const Discord = require("discord.js");
const client = new Discord.Client();
var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var http = require("http");


const sos_id = "285078807952490498";
const test_id = "366410044687908869";
const raidstats_id = "333624859315666945";
var sos;
var test;
var raidstats;
const eof = "!!!!end!!!!";


const bot_admin_id = 285104183466655744;
// number of messages to collect for corpus 
// depends on how many messages you have in your particular server
const message_count = 60000; 
// collect messages before this message 
// set this as the last message before the bot was introduced to channel
// (to avoid discussions about the bot getting into the corpus)
const boundary_message = 366686586802536459; 
// Update attendance every 12 hours
const update_attendance_interval = 12 * 60 * 60 * 1000;


// in messages
var ramble_msg_cd_min = 15;
var ramble_msg_cd_max = 50;
// in milliseconds
var ramble_time_cd_min = 15 * 60 * 1000;
var ramble_time_cd_max = 30 * 60 * 1000;

const intercation_cap_reset_interval = 5 * 60 * 1000;
const interaction_max = 3;

var corpus = [];

var reminder_counts = {};
const reminder_count_max = 5;

var ramble_msg_cd = random_int(ramble_msg_cd_min, ramble_msg_cd_max);
var ramble_time_cd = false;
var corpus_was_read = false;
var just_said_goodnight = false;

function reset_ramble_time_cd() {
	ramble_time_cd = false;
}
function reset_goodnight() {
	just_said_goodnight = false;
}
function send_reminder(user, text) {
	user.send(text);
}

var interaction_caps = {};
function reset_interaction_caps() {
	interaction_caps = {};
	setTimeout(reset_interaction_caps, intercation_cap_reset_interval);
}
reset_interaction_caps();

const goodnight_strings = [
"Good night ",
"Sleep well ",
"Sweet dreams ", 
"See you ", 
];

var clannad_to_sos = {
	"Tomoya": "Caber",
	"Kyou": "Ratvendor",
	"Nagisa": "Nani",
	"Fuuko": "Eternia",
	"Tomoyo": "Bai",
	"Ryou": "Chizen",
	"Akio": "Nutty",
	"Sanae": "Monmusugirl",
	"Kappei": "Rafe",
	"Kouko": "Fulch",
	"Toshio": "Struggle",
	"Yukine": "Kazmura",
	"Misae": "Beleta",
	"Mei": "Lari",
	"Youhei": "Lymetel",
	"Yuusuke": "Kvel",
	"Nishina": "Pappen",
	"Kotomi": "Bot-chan",
	"Ichinose": "Ayane",
};

function extract_kotomis_lines() {
	fs.readFile('clannad_script.txt', 'utf8', (err, corpus_string) => {
		if (err) {
			console.log('Error loading corpus file: ' + err);
			return;
		}
		corpus = corpus_string.split('\n');

		var kotomi_speaking = false;
		var kotomi_lines = [];
		for (var i = 0; i < corpus.length; i++) {
			if (corpus[i].match(":") && !corpus[i].match("Kotomi")) {
				kotomi_speaking = false;
			}
			if (kotomi_speaking && corpus[i].length > 5) {
				for (var key in clannad_to_sos) {
					corpus[i] = corpus[i].replace(key, clannad_to_sos[key]);
				}
				kotomi_lines.push(corpus[i]);
			}
			if (corpus[i].match("Kotomi:")) {
				kotomi_speaking = true;
			}
		}
		fs.writeFile('corpus-kotomi.txt', kotomi_lines.join('\n'), (err) => {
			if (err) throw err;
			console.log('Exported corpus');
		});
	});
}
// extract_kotomis_lines();


client.on("ready", () => {
	sos = client.channels.get(sos_id);
	test = client.channels.get(test_id);
	raidstats = client.channels.get(raidstats_id);
	test.send("I'm ready.");

	import_corpus(true);
	update_attendance();
	get_raidstats();
});

client.on("message", (message) => {
	if(message.author.bot) return;

	var content = message.content;


	// Bot admin commands
	if (message.author.id == bot_admin_id) {
		if (content.startsWith("!collect corpus")) {
			console.log("Collecting corpus");
			fetch_many_messages(sos, message_count);
		} else if (content.startsWith("!export corpus")) {
			console.log("Exporting corpus");
			fs.writeFile('corpus.txt', corpus.join('\n'), (err) => {
				if (err) throw err;
				console.log('Exported corpus');
			});
		} else if (content.startsWith("!import corpus")) {
			import_corpus();
		} else if (content.startsWith("!read corpus")) {
			read_corpus();
		} else if (content.match("!markov") && corpus_was_read) {
			test.send(random_many_words());
		} else if (content.startsWith("!send")) {
			sos.send(content.replace("!send", ""));
		} else if (content.startsWith("!ramble less")) {
			ramble_msg_cd_min *= 2;
			ramble_msg_cd_max *= 2;
			ramble_time_cd_min *= 2;
			ramble_time_cd_max *= 2;
			test.send("Rambling less, MSG: min = " + ramble_msg_cd_min + " max = " + ramble_msg_cd_max + "TIME: min = " + ramble_time_cd_min + " max = " + ramble_time_cd_max);
		} else if (content.startsWith("!ramble more")) {
			ramble_msg_cd_min /= 2;
			ramble_msg_cd_max /= 2;
			ramble_time_cd_min /= 2;
			ramble_time_cd_max /= 2;
			test.send("Rambling more, MSG: min = " + ramble_msg_cd_min + " max = " + ramble_msg_cd_max + "TIME: min = " + ramble_time_cd_min + " max = " + ramble_time_cd_max);
		}
	}


	content = content.substring(0, 100);


	// User commands
	function command_used_in_dm() {
		if (message.channel.id == sos.id || message.channel.id == test.id) {
			message.author.send("To prevent flooding, this command can be used only in DM with me.");
			return false;
		} else {
			return true;
		}
	}
	if (content.startsWith("!remindme")) {
		if (command_used_in_dm()) {
			var message_split = content.split(' ');
			if (message_split.length >= 3 && !isNaN(message_split[1])) {
				var time = message_split[1];
				if (time > 1440) {
					message.author.send("This is too long, try something lower than 24 hours.");
				} else {

					if (!(message.author.id in reminder_counts)) {
						reminder_counts[message.author.id] = 1;
					}
					if (reminder_counts[message.author.id] >= reminder_count_max) {
						message.author.send("You went over the active reminders cap, wait until one of them expires before making a new one.");
					} else {
						reminder_counts[message.author.id] = reminder_counts[message.author.id] + 1;

						var text = content.replace(message_split[0] + " " + message_split[1] + " ", "");
						setTimeout(send_reminder, time * 60 * 1000, message.author, text);
						message.author.send("Will remind you in " + time + " minutes");
					}
				}
			} else {
				message.author.send("!remindme (time in minutes) (message text)");
			}
		}
	} else if (content.startsWith("!attendance")) {
		if (command_used_in_dm()) {
			var name = content.replace("!attendance ", "");
			if (!(name.toLowerCase() in attendance)) {
				message.author.send("No such name (" + name + ") exists in the attendance sheet.");
			} else {
				message.author.send(name + " has " + attendance[name.toLowerCase()] + "% attendance and has attended " + total_days[name.toLowerCase()] + " days total.");
			}
		}
	}


	var message_counts_to_cap = true;
	// Skip messages when author is over cap
	if (!(message.author.id in interaction_caps)) {
		interaction_caps[message.author.id] = 0;
	} else {
		if (interaction_caps[message.author.id] >= interaction_max) {
			return;
		}
	}

	// Random interactions
	if (!just_said_goodnight 
		&& content.match(/(goodnight|good night|gonna sleep|going to sleep)/i))
	{
		just_said_goodnight = true;
		var k = random_int(0, goodnight_strings.length - 1);
		message.channel.send(goodnight_strings[k] + message.author.username);
		setTimeout(reset_goodnight, 60000);
	} else if (content.match(/smile/i) && message.author.username.match("Smiles")) {
		message.channel.send("*smiles at " + message.author.username + "*");
	} else if (content.match(/i love you, bot-chan!/i) || content.match(/i love you bot-chan!/i)) {
		message.channel.send("I love you too!");
	} else if (content.match(/bot-chan|botchan/i)) {
		if (content.match(/help|command/i)) {
			message.author.send("commands:\n!attendance (name)\n!remindme (time in minutes) (text)");
		} else if (content.match("kissu")) {
			message.channel.send("*gives " + message.author.username + " a kissu*");
		} else if (content.match(" ears")) {
			message.channel.send("*massages " + message.author.username + "'s ears*");
		} else if (content.match("morning")) {
			message.channel.send("Hi, " + message.author.username);
		}
	} else {
		message_counts_to_cap = false;

		if (corpus_was_read && message.channel.id == sos.id) {
			// Ramble when time_cd is over AND either msg_cd == 0 OR somebody metioned bot-chan
			// The goal is to ramble once every x msg and respond to mentions, but ultimately be limited by some time
			// So that the bot is active during slow times but doesn't ramble too much when chat is very active
			if (!ramble_time_cd && (ramble_msg_cd < 0 || content.match(/bot-chan|botchan/i))) {
				ramble_msg_cd = random_int(ramble_msg_cd_min, ramble_msg_cd_max);
				ramble_time_cd = true;
				setTimeout(reset_ramble_time_cd, random_int(ramble_time_cd_min, ramble_time_cd_max));

				if (random_int(1, 100) < 90) {
					setTimeout(delayed_response, random_int(20000, 30000));
					if (random_int(1, 3) == 1) {
						sos.channel.send(random_link());
					} else {
						sos.channel.send(random_image());
					} 
				} else {
					if (random_int(1, 3) <= 2) {
						sos.channel.send(random_image());
					} else {
						sos.channel.send(random_link());
					} 
				}
			}
		}
	}


	if (message_counts_to_cap) {
		if (!(message.author.id in interaction_caps)) {
			interaction_caps[message.author.id] = 1;
		} else {
			if (interaction_caps[message.author.id] < interaction_max) {
				interaction_caps[message.author.id] = interaction_caps[message.author.id] + 1;
			}
		}
	}
});

function delayed_response() {
	sos.send(random_many_words());
}

function import_corpus(read_too = false) {
	console.log("Importing corpus");
	fs.exists('corpus.txt', (exists) => {
		if (exists) {
			fs.readFile('corpus.txt', 'utf8', (err, corpus_string) => {
				if (err) {
					console.log('Error loading corpus file: ' + err);
					return;
				}
				console.log('Imported corpus');
				corpus = corpus_string.split('\n');
				if (read_too) {
					read_corpus();
				}
			});
		} else {
			console.log("No corpus.txt found");
		}
	});
}

function read_corpus() {
	corpus_was_read = false;
	console.log("Reading corpus");
	generate_markov_data();
	console.log("Corpus was read");
	corpus_was_read = true;
}

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
	var k = random_int(10, 50);
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

function generate_markov_data() {
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
		if (content.match("4cdn.org")) {
			continue;
		}
		var split_content = content.toString().split(' ');
		if (split_content[0].match("http") && !links.includes(split_content[0])) {
			links.push(split_content[0]);
		}
	}

	// Save images
	for (var i = 0; i < corpus.length; i++) {
		var content = corpus[i];
		if (content.match("4cdn.org")) {
			continue;
		}
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


var welcome_message = "welcome message wasn't loaded";
fs.readFile('welcome message.txt',  'utf8', (err, content) => {
	if (err) {
		console.log('Error loading welcome message file: ' + err);
		return;
	}
	welcome_message = content;
});



client.on('guildMemberAdd', (member) => {
	if (member !== undefined) {
		console.log("guildMemberAdd " + member.nickname);
		member.send(welcome_message);
	}
})


fs.readFile('token.txt', 'utf8', function (err, content) {
	if (err) {
		console.log('Error loading token file: ' + err);
		return;
	}
	client.login(content);
});









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

function update_attendance() {
	fs.readFile('client_secret.json', function processClientSecrets(err, content) {
		if (err) {
			console.log('Error loading client secret file: ' + err);
			return;
		}
	  	// Authorize a client with the loaded credentials, then call the
	  	// Google Sheets API.
	  	authorize(JSON.parse(content), retrieve_attendance);
	  });

	setTimeout(update_attendance, update_attendance_interval);
}

// Create an OAuth2 client with the given credentials, and then execute the
// given callback function.
// @param {Object} credentials The authorization client credentials.
// @param {function} callback The callback to call with the authorized client.
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

// Get and store new token after prompting for user authorization, and then
// execute the given callback with the authorized OAuth2 client.
// @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
// @param {getEventsCallback} callback The callback to call with the authorized client.
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


// Store token to disk be used in later program executions.
// @param {Object} token The token to store to disk.
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

			console.log("Attendance data updated");
		}
	});
}


// ------------------------------------------------------------
//						 RAIDSTATS
// ------------------------------------------------------------


var realmplayers_http_get_options = {
	host: 'www.realmplayers.com',
	port: 80,
	path: '/RaidStats/RaidList.aspx?realm=Ely&guild=SOS%20Brigade'
};


var raidstats_string = "";
var raids = [];
var names = [];
var dates = [];

// Do this every hour
function get_raidstats() {
	console.log("Getting raidstats");
	http.get(realmplayers_http_get_options, function (response) {
		console.log("Got response: " + response.statusCode);
		response.on('data', function (chunk) {
			raidstats_string += chunk;
		});
		response.on('end', function () {
			process_string();
		});
	}).on('error', function (e) {
		console.log("Got error: " + e.message);
	});
	setTimeout(get_raidstats, 60 * 60 * 1000);
}


function process_string() {
	// console.log(raidstats_string);

	var string = raidstats_string;

	raids = [];
	names = [];
	dates = [];

	var raid_match = "RaidOverview.aspx\\?Raid=";

	while (true) {
		if (!raidstats_string.match(raid_match)) {
			break;
		} else {
			var start_index = raidstats_string.match(raid_match).index;
			raidstats_string = raidstats_string.substring(start_index);
			var raid_id = raidstats_string.substring(
				raidstats_string.indexOf('=') + 1, raidstats_string.indexOf('\"'));
			raids.push(raid_id);
			raidstats_string = raidstats_string.substring(raidstats_string.indexOf('\"'));
			raidstats_string = raidstats_string.substring(raidstats_string.indexOf(".png\"/> ") + ".png\"/> ".length);
			var name = raidstats_string.substring(0, raidstats_string.indexOf('('));;
			names.push(name);
			raidstats_string = raidstats_string.substring(raidstats_string.indexOf("</a></td><td>") + "</a></td><td>".length);
			var date = raidstats_string.substring(0, raidstats_string.indexOf(' '));
			dates.push(date);
		}
	}

	var new_raids = [];

	fs.exists('reported_raids.txt', (exists) => {
		if (exists) {
			fs.readFile('reported_raids.txt', 'utf8', (err, text_string) => {
				var reported_raids = text_string.split('\n');

				for (var i = 0; i < raids.length; i++) {
					var raid = raids[i];
					var date = dates[i];
					var name = names[i];
					if (!reported_raids.includes(raid)) {
						reported_raids.push(raid);
						new_raids.push("@everyone " + name + " - " + date + " " + "http://realmplayers.com/RaidStats/RaidOverview.aspx?Raid=" + raid);
					}
				}

				fs.writeFile('reported_raids.txt', reported_raids.join('\n'), (err) => {
					if (err) throw err;
					console.log('Wrote reported_raids.txt');
				});

				console.log("New raids found:");
				for (var i = 0; i < new_raids.length; i++) {
					// Send message to raid_stats channel
					raidstats.send(new_raids[i]);
				}
			});
		} else {
			console.log("No reported_raids.txt found");
		}
	});
}