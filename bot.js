const Discord = require("discord.js");
const client = new Discord.Client();

var sos_id = "285078807952490498";
var test_id = "366410044687908869";
var sos;
var test;
const eof = "!!end!!";

var all_messages = [];

client.on("ready", () => {
	console.log("I am ready!");

	sos = client.channels.get(sos_id);
	test = client.channels.get(test_id);
	test.send("I'm ready.");
});

// see how to save persistent data(fucking json...)
// filter some stuff(lym) nazi
// add more commands
// connect to google sheets

var next_msg = 0;
var rdy_to_markov = false;
var reply_cd = false;

function reset_reply_cd() {
	reply_cd = false;
}

client.on("message", (message) => {
	if(message.author.bot) return;

	if (message.content.match("log") && message.author.username.match("kwell")) {
		console.log("logging");
		fetchManyMessages(sos, 50000);
	} else if (message.content.match("markov") && message.author.username.match("kwell")) {
		test.send(random_many_words());
	} else if (message.content.startsWith("send-sos ") && message.author.username.match("kwell")) {
		sos.send(message.content.replace("send-sos ", ""));
	} else if (message.content.match("smile") && message.author.username.match("Smiles")) {
		message.channel.send("*smiles at " + message.author.username + "*");
	} else if (message.content.startsWith("I love you, Bot-chan!")) {
		message.channel.send("I love you too!");
	} else if ((message.content.match("Bot") || message.content.match("bot"))  && message.content.match("kissu")) {
		message.channel.send("*gives " + message.author.username + " a kissu*");
	} else if ((message.content.match("Bot") || message.content.match("bot"))  && message.content.match("ears")) {
		message.channel.send("*massages " + message.author.username + "'s ears*");
	} else if ((message.content.match("Bot") || message.content.match("bot"))  && message.content.match("morning")) {
		message.channel.send("Hi, " + message.author.username);
	} else if (message.content.match("ohayou") || message.content.match("Ohayou")) {
		message.channel.send("Hi, " + message.author.username);
	} else if (rdy_to_markov) {
		// reply sometimes, reply more often when ppl talk about the bot
		next_msg--;

		if (!reply_cd && (message.content.match("bot") || message.content.match("Bot"))) {
			sos.send(random_many_words());
			reply_cd = true;
			setTimeout(reset_reply_cd, random_int(10000, 20000));
		} else if (next_msg < 0) {
			sos.send(random_many_words());
			next_msg = random_int(80, 200);
		}
	}

	
});

// inclusive both sides
function random_int(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}




function random_word(struct) {
	var total = struct.word_counts_incremented[struct.word_counts_incremented.length - 1];
	var k = random_int(0, total);
	// console.log(k);
	for (var i = 0; i < struct.words.length; i++) {
		if (k <= struct.word_counts_incremented[i]) {
			return struct.words[i];
		}
	}
}

function force_many() {
	var str = "";
	var i = 0;
	var count = 0;
	var max_count = 0;

	while (count < 10) {

		var ret = random_many_words(struct);
		var new_str = ret.str;
		count = ret.count;
		if (count > max_count) {
			max_count = 0;
			str = new_str;
		}
		i++;
		if (i > 1000) {
			break;
		}
	}
	

	return str;
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

function do_markov() {
	// Set up firsts words
	for (var i = 0; i < all_messages.length; i++) {
		var content = all_messages[i];
		var split_content = content.toString().split(' ');

		if (split_content.length >= 4) {
			count_word(split_content[0] + " " + split_content[1], firsts);
		} 
	}

	add_up_increments(firsts);

	// Set up pairs
	for (var i = 0; i < all_messages.length; i++) {
		var content = all_messages[i];
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
}




const step = 100;

function fetchManyMessages(channel, lim) {
	channel.fetchMessages({limit: step}).then(messages => fetchManyMessagesR(channel, lim - step, messages));
}
function fetchManyMessagesR(channel, lim, messages) {
	all_messages = all_messages.concat(messages.array());

	if (lim % 1000 == 0) {
		console.log(lim);
	}

	if (lim <= 0) {
		console.log("done logging");


		do_markov();
		rdy_to_markov = true;
		return;
	} else {
		channel.fetchMessages({limit: step, before: messages.last().id}).then(messages => fetchManyMessagesR(channel, lim - step, messages));
	}
}


client.on('guildMemberAdd', (member) => {
	console.log("guildMemberAdd");
	member.send("Welcome to my server!");
})

client.login("YOUR ID");


