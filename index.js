window.escapeHTML   = function(msg){
  return (msg||"").replace(/\&/g, "&amp;").replace(/\</g, "&lt;").replace(/\>/g, "&gt;");
};
window.toHTMLEntity = function(str) {
  str = str||"";
  var bb = '';
  for(i=0; i<str.length; i++){
    if(str.charCodeAt(i)>127){
//      console.log(str.charAt(i));
      bb += "&#"+str.charCodeAt(i)+";"; //'&#' + str.charCodeAt(i) + ';';
    }else{
      bb += str.charAt(i);
    }
  }
  return bb;
}
window.saveAs = window.saveAs || window.webkitSaveAs || window.mozSaveAs || window.msSaveAs;
// --
function log(msg){
	msg = msg||"";
	$("#log").append("<div>"+escapeHTML(msg)+"</div>");
	console.log("log", msg);
	scrollLogToBottom();
}
function log2(msg){
	msg = msg||"";
	$("#log").append("<div class='log2'>&nbsp;- "+escapeHTML(msg)+"</div>");
	console.log("log2", msg);
	scrollLogToBottom();
}
function log3(msg){
	msg = msg||"";
	$("#log").append("<div class='log3'>&nbsp;* "+escapeHTML(msg)+"</div>");
	console.log("log3", msg);
	scrollLogToBottom();
}
function err(msg){
	msg = msg||"";
	$("#log").append("<div class='err'>Error: "+escapeHTML(msg)+"</div>");
	console.warn("err", msg);
	scrollLogToBottom();
}
function clearLog(){
	$("#log").html("");
}
function scrollLogToBottom(){
	$("#log").scrollTop(999999);
}
// --
function wrapInQuotesForCSV(txt){
	txt = txt||"";
	console.log(txt);
	txt = txt.replace(/\\"/g, "'");
	txt = txt.replace(/[\r\n]/g, " | ");
	return '"'+txt+'"';
}
function autoParseData_iOS(data){
	var tmp = "";
	if(data && data.feed && data.feed.entry){
		var entries = data.feed.entry||[];
		var appname = "";
		var date 		= "2000-01-01";
		if(data.feed.updated && data.feed.updated.label){
			date = wrapInQuotesForCSV(data.feed.updated.label);
		}
		for(var e=0; e<entries.length; e++){
			var ent = entries[e];
			if(e==0 && ent["im:name"] && ent["im:name"].label){
				appname = ent["im:name"].label+" ";
			}
			if(ent && ent.content){
				var form = '"Ver. ?"';
				if(ent["im:version"] && ent["im:version"].label){
					form = wrapInQuotesForCSV("Ver. "+ent["im:version"].label);
				}
				// TODO: include DATE here if we have the data (doesn't seem to exist in the JSON?)
				var user = wrapInQuotesForCSV(((ent.author||{}).name||{}).label||"---");
				var q    = wrapInQuotesForCSV(appname+"Review");
				var r0   = (ent.title||{}).label||"";
				var r1   = (ent.content||{}).label||"";
				var r    = wrapInQuotesForCSV(r0+" | "+r1);
				tmp += form+","+date+","+user+","+q+","+r+"\n";
				// --
				if(ent["im:rating"] && ent["im:rating"].label){
					var rating = parseFloat(ent["im:rating"].label);
					if(!isNaN(rating)){
						var q    = wrapInQuotesForCSV(appname+"Rating");
						tmp += form+","+date+","+user+","+q+","+rating+"\n";
					}
				}
			}
		}
	}
	return tmp;
}
// --
$(document).ready(function(){
	var hash = window.location.hash;
	if(hash && hash.length > 1){
		if(hash.indexOf("/") >= 0){
			log("Fetching CSV via URL...");
			var urlToLoad = hash.substring(1);
			$.get(urlToLoad, function(a,b){
				if(a && a.length > 0){
					processCSV(a);
				}else{
					console.log(b);
					log("Drop CSV file above...");
				}
			});
		}else{
			log("Fetching Realtime JSON...");
			var d = hash.substring(1);
			var da = d.split(",");
			var tmpcsv = "Form,Date,User,Q,R\n";
			if(da && da.length > 1){
				switch(da[0].toLowerCase()){
				case "ios":
					log("Getting iOS App Reviews [x"+(da.length-1)+"]");
					(function(){
						var i=1;
						function loop(){
							if(i < da.length){
								var appid = da[i];
								log("APP ID: "+appid)
								var url = "https://itunes.apple.com/rss/customerreviews/id="+appid+"/sortBy=mostRecent/json";
								$.getJSON(url, function(data, status, jqXHR){
									var newcsv = autoParseData_iOS(data);
									var added  = Math.max(0, (newcsv.split("\n")||[]).length-1);
									tmpcsv += newcsv;
									log(" -> "+added+" entries.");
									// --
									i++;
									loop();
								});
							}else{
								log("DONE -- Fetched all data.");
								processCSV(tmpcsv);
							}
						}
						loop();
					})();
					break;
				default:
					err("Unrecognized json type: "+da[0]);
					log("Drop CSV file above...");
				}
				//var urlToLoad = hash.substring(1);
				//https://itunes.apple.com/rss/customerreviews/id=814998374/json
			}else{
				err("Couldn't make sense of hash: "+hash);
				log("Drop CSV file above...");
			}
		}
	}else{
		log("Drop CSV file above...");
	}
});
// --
// FormID,Date,UserID,Question,Response --- TYPE, SENTIMENT,
//
// Response type automatically inferred as either:
//  - Text   (multiple words with spaces, often quoted. If you have multiple paragraphs/sections, separate with a "|" and keep all on one line)
//  - Number (integer or float. will parse first number seen: 93%-effective -> 93)
//  - Enum   (single word selection. Multiple selections via "|": apples|pears -> apples and pears selected)
// 
// --
var CSV_EXPECTED_INPUT_COLS   = 5;
var CSV_INDEX_FORM 						= 0;
var CSV_INDEX_DATE 						= 1;
var CSV_INDEX_USER 						= 2;
var CSV_INDEX_Q 	 						= 3;
var CSV_INDEX_R 	 						= 4;
var CSV_INDEX_CALC_TYPE 			= 5;
var CSV_INDEX_CALC_SENTIMENT 	= 6;
// --
var csv	 					= [];
var csvHeaders 		= [];
var csvStats 			= {};
var csvQuestions 	= {};
// -------
// CRUNCH THE DATA
// -------
var lastReadFile;
function getAsText(readFile, loadedFn){
	var reader = new FileReader();
	reader.onload = loadedFn;
	reader.readAsText(readFile); //, "windows-1252"); //, "UTF-8");
	lastReadFile = readFile;
}
function getAsTextWithEncoding(encoding){
	var reader = new FileReader();
	reader.readAsText(lastReadFile, encoding); //, "windows-1252"); //, "UTF-8");
	reader.onload = loaded2;
}
function csvFileLoad(){
	clearLog();
	var files = $('#csvinput').get(0).files;
	if(files.length > 0){
		console.log(files[0]); 
		log("Opening CSV file: "+files[0].name+", "+files[0].type);
		if(files[0].name.toLowerCase().indexOf("csv") < 0){
			return err("Bad file type (not CSV)");
		}
		getAsText(files[0], csvFileLoadedWithTxt);
	}
}
function csvFileLoadedWithTxt(evt){
	var fileString = evt.target.result||"";
	log("File size: "+(fileString.length/1024.0).toFixed(2)+"kb");
	// --
	processCSV(fileString);
}
// --
var p = [];
function processCSV(csvtxt){
	log("Ready to process.");
	log("- - - - - - - - -");
	// --
	csv 					= [];
	csvStats			= {};
	csvHeaders		= [];
	csvQuestions 	= {};
	// --
	var timeBetween   = 50;
	var i = 0;
	log("Splitting CSV into array...")
	var parsedcsv = Papa.parse(csvtxt, {
		delimiter: ",",	
		newline: "",	
		header: false,
		dynamicTyping: false,
		preview: 0,
		encoding: "",
		worker: false,
		comments: true,
		step: undefined,
		complete: undefined,
		error: undefined,
		download: false,
		skipEmptyLines: true,
		chunk: undefined,
		fastMode: false
	})||{};
	if(!parsedcsv.errors || parsedcsv.errors.length > 0 || !parsedcsv.data){
		err("CSV parse error. "+parsedcsv.errors[0].message+", ROW:"+(parsedcsv.errors[0].row+1)+" See console.");
		console.log(parsedcsv);
		return;
	}
	csv = parsedcsv.data||[];
	// --
	var cols = csv[0].length;
	if(cols != CSV_EXPECTED_INPUT_COLS) err("Wrong number of columns, should be "+CSV_EXPECTED_INPUT_COLS+" -- missing something?");
	// --
	log("--> "+cols+" cols, "+(csv.length-1)+" rows");
	var badRows = 0;
	for(i=1; i<csv.length; i++){
		if(csv[i].length != cols){
			badRows++;
			err("row["+i+"] had "+csv[i].length+" columns.");
		}
	}
	if(badRows>0) err(" ** "+badRows+" BAD ROWS! **");
	csvHeaders = csv.shift();
	log("- - -");
	// --
	i = 0;
	function loop(){
		if(i < p.length){
			log("["+(i+1)+"/"+p.length+"] "+p[i][0]+"...");
			p[i][1]();
			// --
			i++;
			setTimeout(loop, timeBetween);
		}else{
			// done! 
			htmlRenderAll();
			// --
			log("- - -");
			log("Parsing complete! ");
		}
	}
	// start async for loop...
	loop();
}
function saveModifiedCSV(){
	log("Generating Modified CSV...");
	var csvtxt2 = '"'+csvHeaders.join('","')+'"\n';
	for(var j=0; j<csv.length; j++){
		csvtxt2 += '"'+csv[j].join('","')+'"\n';
	}
	var blob = new Blob([csvtxt2], { type: "text/csv;charset=utf-8" });
	// --
	$('#csvinput').val(""); // clear out file input so same file can be dropped agian.
	// --
	if (window.saveAs) {
		log("Ready to save.");
		window.saveAs(blob, lastReadFile.name+".parsed.csv");
	}
}
// --
function tokenize(input) {
    return input
            .replace(/[^a-zA-Z- ]+/g, '')
            .replace('/ {2,}/',' ')
            .toLowerCase()
            .split(' ');
}
function strOccurrences(string, subString, allowOverlapping){

    string+=""; subString+="";
    if(subString.length<=0) return string.length+1;

    var n=0, pos=0;
    var step=(allowOverlapping)?(1):(subString.length);

    while(true){
        pos=string.indexOf(subString,pos);
        if(pos>=0){ n++; pos+=step; } else break;
    }
    return(n);
}
function getStatsFromArray(arr, type, enumcountobj){
	var stats = {};
	stats.mean 			= ss.mean(arr)||0;
	stats.min  			= ss.min(arr)||0;
	stats.max  			= ss.max(arr)||0;
	stats.mode 			= ss.mode(arr)||0;
	stats.var     	= ss.variance(arr)||0;
	stats.stddev    = ss.standard_deviation(arr)||0;
	stats.meanabsdv = ss.median_absolute_deviation(arr)||0;
	stats.sampvar   = ss.sample_variance(arr)||0;
	stats.len       = arr.length||0;
	// --
	if(type == QUALTYPE_ENUM){
		var enums = [];
		var samps = 0;
		_.each(enumcountobj, function(val, key){
			enums.push({n:key, o:val});
			samps += val;
		});
		enums.sort(function(a,b){return b.o - a.o;});
		// --
		if(enums.length > 0){
			stats.min = enums[enums.length-1].o;
			stats.max = enums[0].o;
		}
		// --
		stats.enums = enums;
		stats.len   = samps;
	}
	// --
	if(type == QUALTYPE_TEXT){
		// Always show sentiment symetricly (|max| == |min|)
		var maxmin = Math.max(0.1, Math.abs(stats.min), Math.abs(stats.max));
		stats.drawmin   = -maxmin;
		stats.drawmax   = maxmin;
	}else{
		stats.drawmin   = Math.min(1, Math.floor(stats.min));
		stats.drawmax   = Math.max(1, Math.ceil(stats.max));
	}
	// --
	return stats;
}
// --
var regExpCleanWords 					= '[^\\s\\.\\,\\!\\?\\:\\;\\"\\(\\)\\[\\]\\{\\}\\-\\%]';
var REGEXP_MATCH_WORDS_CLEAN 	= new RegExp(regExpCleanWords+'+', "g");
var MAX_PHRASE_WORDS 					= 15;
var MIN_WORDS_PER_PHRASE 			= 2;
var phraser = (function(){
	var exports = {};
	// --
	var commonNoninterestingWords = {
		// propositions
		"abaft":1,"aboard":1,"about":1,"above":1,"absent":1,"across":1,"afore":1,"after":1,"against":1,"along":1,"alongside":1,"amid":1,"amidst":1,"among":1,"amongst":1,"anenst":1,"apropos":1,"apud":1,"around":1,"as":1,"aside":1,"astride":1,"at":1,"athwart":1,"atop":1,"barring":1,"before":1,"behind":1,"below":1,"beneath":1,"beside":1,"besides":1,"between":1,"beyond":1,"but":1,"by":1,"circa":1,"concerning":1,"despite":1,"down":1,"during":1,"except":1,"excluding":1,"failing":1,"following":1,"for":1,"forenenst":1,"from":1,"given":1,"in":1,"including":1,"inside":1,"into":1,"lest":1,"like":1,"mid":1,"midst":1,"minus":1,"modulo":1,"near":1,"next":1,"notwithstanding":1,"of":1,"off":1,"on":1,"onto":1,"opposite":1,"out":1,"outside":1,"over":1,"pace":1,"past":1,"per":1,"plus":1,"pro":1,"qua":1,"regarding":1,"round":1,"sans":1,"save":1,"since":1,"than":1,"through":1,"throughout":1,"till":1,"times":1,"to":1,"toward":1,"towards":1,"under":1,"underneath":1,"unlike":1,"until":1,"unto":1,"up":1,"upon":1,"versus":1,"via":1,"vice":1,"with":1,"within":1,"without":1,"worth":1,
		// articles
		"a":1,"an":1,"the":1,
		// conjunctions
		"accordingly":1, "after":1, "although":1, "and":1, "as":1, "as":1, "far":1, "as":1, "as":1, "how":1, "as":1, "if":1, "as":1, "long":1, "as":1, "as":1, "soon":1, "as":1, "as":1, "though":1, "as":1, "well":1, "as":1, "because":1, "before":1, "both":1, "but":1, "either":1, "even":1, "if":1, "even":1, "though":1, "for":1, "how":1, "however":1, "if":1, "if":1, "only":1, "in":1, "case":1, "in":1, "order":1, "that":1, "neither":1, "nor":1, "now":1, "once":1, "only":1, "or":1, "provided":1, "rather":1, "than":1, "since":1, "so":1, "so":1, "that":1, "than":1, "that":1, "though":1, "till":1, "unless":1, "until":1, "when":1, "whenever":1, "where":1, "whereas":1, "wherever":1, "whether":1, "while":1, "yet":1,
		// helping verbs
		"is":1,"am":1,"are":1,"was":1,"were":1,"be":1,"being":1,"been":1,"have":1,"has":1,"have":1,"having":1,"had":1,"can":1,"will":1,"do":1,"does":1,"did":1,"would":1,"could":1,"get":1, 'getting':1, "got":1, 
		// negators
		"not":1, "non":1, 
		// pronouns
		"all":1, "an":1, "another":1, "any":1, "both":1, "each":1, "either":1, "every":1, "her":1, "his":1, "its":1, "my":1, "neither":1, "no":1, "other":1, "our":1, "per":1, "some":1, "that":1, "the":1, "their":1, "these":1, "this":1, "those":1, "whatever":1, "whichever":1, "your":1, "all":1, "another":1, "any":1, "anybody":1, "anyone":1, "anything":1, "both":1, "each":1, "each other":1, "either":1, "everybody":1, "everyone":1, "everything":1, "few":1, "he":1, "her":1, "hers":1, "herself":1, "him":1, "himself":1, "his":1, "i":1, "it":1, "its":1, "itself":1, "many":1, "me":1, "mine":1, "my":1, "myself":1, "neither":1, "noone":1, "nobody":1, "none":1, "nothing":1, "one":1, "one another":1, "other":1, "ours":1, "ourselves":1, "several":1, "she":1, "some":1, "somebody":1, "someone":1, "something":1, "such":1, "that":1, "theirs":1, "them":1, "themselves":1, "these":1, "they":1, "this":1, "those":1, "us":1, "we":1, "what":1, "whatever":1, "which":1, "whichever":1, "who":1, "whoever":1, "whom":1, "whomever":1, "whose":1, "you":1, "yours":1, "yourself":1, "yourselves":1, 
		// places
		"here":1, "there":1, "nowhere":1, "everywhere":1, "end":1, "beginning":1,
		// contractions
		"i'm":1, "you're":1, "don't":1, "doesn't":1, "didn't":1, "can't":1, "won't":1, "isn't":1, "hasn't":1, "it's":1, "i've":1, "i'd":1, 
		// other common words
		"more":1, "less":1, "most":1, "least":1, "able":1, "unable":1, "very":1, "much":1, "seem":1, "seems":1, "try":1, "trying":1, "tried":1, "make":1, "made":1, "making":1, "just":1, "should":1, "also":1, "really":1, "thought":1, "put":1, "way":1, "set":1, "lot":1, "little":1,
	};
	exports.commonNoninterestingWords = commonNoninterestingWords;
	// --
	function ngrams(a, n) {
	    return a.map(function(_, i) {
	        return a.slice(i, i + n);
	    }).slice(0, 1 - n);
	}
	function count(a) {
	    return a.reduce(function(c, x) {
	        c[x] = (c[x] || 0) + 1;
	        return c;
	    }, {});
	}
	function mostCommon(c) {
	    return Object.keys(c).map(function(x) {
	        return [x, c[x]]
	    }).filter(function(a) {
				return a[1] > 1; // only keep results with more than one repeat
	    }).sort(function(a, b) {
	        return b[1] - a[1] // sort with most repeated first.
	    });
	}
	// --
	exports._ngrams 		= ngrams;
	exports._count  		= count;
	exports._mostCommon = mostCommon;
	exports.find = function(wordsarray, wordsPerPhrase, maxkeepers){
		if(wordsPerPhrase > 1){
			return mostCommon(count(ngrams(wordsarray, wordsPerPhrase))).slice(0,maxkeepers||100);
		}else{
			return mostCommon(count(wordsarray)).slice(0,maxkeepers||100);
		}
	};
	exports.findWordsBefore = function(wordsarray, rootword, maxkeepers){
		var before = {};
		for(var i=1; i<wordsarray.length; i++){
			if(wordsarray[i] == rootword){
				var w2 = wordsarray[i-1];
				// if the word is common, keep walking back (up to two previous words) looking for more.
				if(commonNoninterestingWords[w2] && i>1){
					var w3 = wordsarray[i-2];
					w2 = w3+" "+w2;
					if(commonNoninterestingWords[w3] && i>2) w2 = wordsarray[i-3]+" "+w2;
				}
				// --
				if(w2.indexOf("|")<0) before[w2] = (before[w2]||0)+1;
			}
		}
		var befarr = [];
		_.each(before, function(val, key){
			befarr.push({t:key, o:val});
		});
		befarr.sort(function(a,b){return b.o-a.o;});
		return befarr;
	}
	exports.findWordsAfter = function(wordsarray, rootword, maxkeepers){
		var before = {};
		for(var i=0; i<wordsarray.length-1; i++){
			if(wordsarray[i] == rootword){
				var w2 = wordsarray[i+1];
				// if the word is common, keep walking forward (up to two next words) looking for more.
				if(commonNoninterestingWords[w2] && i<wordsarray.length-2){
					var w3 = wordsarray[i+2];
					w2 = w2+" "+w3;
					if(commonNoninterestingWords[w3] && wordsarray.length-3) w2 = w2+" "+wordsarray[i+3];
				}
				//
				if(w2.indexOf("|")<0) before[w2] = (before[w2]||0)+1;
			}
		}
		var befarr = [];
		_.each(before, function(val, key){
			befarr.push({t:key, o:val});
		});
		befarr.sort(function(a,b){return b.o-a.o;});
		return befarr;
	}
	return exports;
})()
// --
var QUALTYPE_UNKNOWN = "t/???";
var QUALTYPE_TEXT 	 = "t/txt";
var QUALTYPE_NUMBER  = "t/num";
var QUALTYPE_ENUM    = "t/enu";
// --

p.push(["Type handling", function(){
	var qualTypeForQs = {};
	for(var i=0; i<csv.length; i++){
		csv[i][CSV_INDEX_DATE] = new Date(csv[i][CSV_INDEX_DATE]);
		if((csv[i][CSV_INDEX_R]||"").length==0 || (csv[i][CSV_INDEX_R]||"").indexOf("null")==0) csv[i][CSV_INDEX_R] = "";
		// --
		if(!qualTypeForQs[csv[i][CSV_INDEX_Q]]) qualTypeForQs[csv[i][CSV_INDEX_Q]] = QUALTYPE_UNKNOWN;
		if(csv[i][CSV_INDEX_R].indexOf(" ") > 0){
			// text is the catch-all if the response includes a space afer initial position
			qualTypeForQs[csv[i][CSV_INDEX_Q]] = QUALTYPE_TEXT;
		}
		if(qualTypeForQs[csv[i][CSV_INDEX_Q]] == QUALTYPE_UNKNOWN || qualTypeForQs[csv[i][CSV_INDEX_Q]] == QUALTYPE_NUMBER){
			// It's not text... and hasn't been classified as an enum... Is it a number or enum?
			if(csv[i][CSV_INDEX_R].length > 0){ // make sure there is a respone...
				var fval = parseFloat(csv[i][CSV_INDEX_R]);
				if(isNaN(fval)){
					qualTypeForQs[csv[i][CSV_INDEX_Q]] = QUALTYPE_ENUM;
				}else{
					qualTypeForQs[csv[i][CSV_INDEX_Q]] = QUALTYPE_NUMBER;
				}
			}
		}
	}
	// --
	for(var i=0; i<csv.length; i++){
		csv[i][CSV_INDEX_CALC_TYPE] = qualTypeForQs[csv[i][CSV_INDEX_Q]] || QUALTYPE_UNKNOWN;
		if(csv[i][CSV_INDEX_CALC_TYPE] == QUALTYPE_TEXT) csv[i][CSV_INDEX_R] = csv[i][CSV_INDEX_R].replace(/\./g, " | "); // we split sentences so that we don't get carryover between phrases.
		if(csv[i][CSV_INDEX_CALC_TYPE] == QUALTYPE_NUMBER) csv[i][CSV_INDEX_R] = parseFloat(csv[i][CSV_INDEX_R]);
		if(csv[i][CSV_INDEX_CALC_TYPE] == QUALTYPE_UNKNOWN) err("Not enough response info to determine data type. row: "+(i+1)+", Question: '"+csv[i][CSV_INDEX_Q]+"'");
	}
	csvHeaders[CSV_INDEX_CALC_TYPE] = "TYPE";
}]);
p.push(["Normalizing words", function(){
	var r_words = {};
	var r_txt   = "";
	for(var i=0; i<csv.length; i++){
		if(csv[i][CSV_INDEX_CALC_TYPE] == QUALTYPE_TEXT){
			r_txt += csv[i][CSV_INDEX_R]+" | ";
		}
	}
	// --
	csvStats.allRTxt 		= r_txt;
	csvStats.allRTxtArr = (r_txt||"").toLowerCase().match(REGEXP_MATCH_WORDS_CLEAN);
}]);
// --
p.push(["Global phrases len=1", function(){
	csvStats.phrases = [];
	csvStats.phrases[0] = phraser.find(csvStats.allRTxtArr, 1, 200);
}]);
p.push(["Global phrases len=2", function(){
	csvStats.phrases[1] = phraser.find(csvStats.allRTxtArr, 2, 100);
}]);
p.push(["Global phrases len=3", function(){
	csvStats.phrases[2] = phraser.find(csvStats.allRTxtArr, 3, 100);
}]);
p.push(["Global phrases len=4", function(){
	csvStats.phrases[3] = phraser.find(csvStats.allRTxtArr, 4, 100);
}]);
p.push(["Global phrases len=5", function(){
	csvStats.phrases[4] = phraser.find(csvStats.allRTxtArr, 5, 100);
}]);
p.push(["Global phrases len=6", function(){
	csvStats.phrases[5] = phraser.find(csvStats.allRTxtArr, 6, 100);
}]);
p.push(["Global phrases len=7", function(){
	csvStats.phrases[6] = phraser.find(csvStats.allRTxtArr, 7, 100);
}]);
p.push(["Global phrases len=8", function(){
	csvStats.phrases[7] = phraser.find(csvStats.allRTxtArr, 8, 100);
}]);
p.push(["Global phrases len=9", function(){
	csvStats.phrases[8] = phraser.find(csvStats.allRTxtArr, 9, 100);
}]);
p.push(["Global phrases len=10", function(){
	csvStats.phrases[9] = phraser.find(csvStats.allRTxtArr, 10, 100);
}]);
p.push(["Global phrases len=11", function(){
	csvStats.phrases[10] = phraser.find(csvStats.allRTxtArr, 11, 100);
}]);
p.push(["Global phrases len=12", function(){
	csvStats.phrases[11] = phraser.find(csvStats.allRTxtArr, 12, 100);
}]);
p.push(["Global phrases len=13", function(){
	csvStats.phrases[12] = phraser.find(csvStats.allRTxtArr, 13, 100);
}]);
p.push(["Global phrases len=14", function(){
	csvStats.phrases[13] = phraser.find(csvStats.allRTxtArr, 14, 100);
}]);
p.push(["Global phrases len=15", function(){
	csvStats.phrases[14] = phraser.find(csvStats.allRTxtArr, 15, 100);
}]);
p.push(["Global phrases unique only", function(){
	for(var l=MAX_PHRASE_WORDS-1; l>=0; l--){
		var largerPhrases = csvStats.phrases[l];
		for(var l0=0; l0<largerPhrases.length; l0++){
			var lphrase = ","+largerPhrases[l0][0]+",";
			var lphraseCount = largerPhrases[l0][1];
			for(var s=l-1; s>=(MIN_WORDS_PER_PHRASE-1); s--){
				var smallerPhrases = csvStats.phrases[s];
				// check for duplicates and decrement occurrances
				for(var s0=0; s0<smallerPhrases.length; s0++){
					var sphrase = ","+smallerPhrases[s0][0]+",";
					if(lphrase.indexOf(sphrase) >= 0){
						// duplicate found...
						smallerPhrases[s0][1] -= lphraseCount;
						//console.log("decremented: "+sphrase+" [was in] "+lphrase+" [x "+lphraseCount+"]");
					}
				}
				// -- remove any smaller phrases that have <= 0 occurrances.
				for(var s0=smallerPhrases.length-1; s0>=0; s0--){
					if(smallerPhrases[s0][1] <= 0) smallerPhrases.splice(s0, 1);
					//console.log("Removed!");
				}
			}
		}
	}
}]);
p.push(["Global phrase stats", function(){
	// --
	var phraseFreq = [];
	var wordFreq   = [];
	for(var l=MAX_PHRASE_WORDS-1; l>=0; l--){
		var largerPhrases = csvStats.phrases[l];
		for(var l0=0; l0<largerPhrases.length; l0++){
			var lphrase = largerPhrases[l0][0];
			if(lphrase && lphrase.length>1){
				var lphrasePretty = lphrase.replace(/,/g, " ");
				var words = lphrase.split(",");
				var hassubstance = false;
				for(var s1=0; s1<words.length; s1++) if(!phraser.commonNoninterestingWords[words[s1]]) hassubstance = true;
				// --
				if(lphrasePretty.indexOf("|") < 0){ // don't include phrases that have a sentence/pragraph break.
					if(l >= MIN_WORDS_PER_PHRASE-1){
						if(hassubstance) phraseFreq.push({t:lphrasePretty, o:largerPhrases[l0][1]});
					}else{
						if(lphrasePretty.length >= 3 && hassubstance){
							wordFreq.push({t:lphrasePretty, o:largerPhrases[l0][1]});
						}
					}
				}
			}
		}
	}
	csvStats.phraseFreq = phraseFreq.sort(function(a, b){return b.o-a.o});
	csvStats.wordFreq 	= wordFreq.sort(function(a, b){return b.o-a.o});
	// --
	// for each questions, update number or responses.
	for(var i=0; i<csv.length; i++){
		var row = csv[i];
		csvQuestions[row[CSV_INDEX_Q]] = csvQuestions[row[CSV_INDEX_Q]]||{type:row[CSV_INDEX_CALC_TYPE], resp:0};
		csvQuestions[row[CSV_INDEX_Q]].resp++;
	}
}]);
// --
p.push(["Building word tree", function(){
	var wtree = {};
	var wf = csvStats.wordFreq;
	for(var i=0; i<wf.length; i++){
		var w = wf[i];
		var node = {t:w.t, o:w.o};
		// --
		node.b = phraser.findWordsBefore(csvStats.allRTxtArr, w.t, 40);
		node.a = phraser.findWordsAfter(csvStats.allRTxtArr, w.t, 40);
		// --
		wtree[w.t] = node;
	}
	// --
	csvStats.wtree = wtree;
}]);
// --
p.push(["Analyzing sentiment [each]", function(){
	csvHeaders[CSV_INDEX_CALC_SENTIMENT] = "SENTIMENT";
	for(var i=0; i<csv.length; i++){
		if(csv[i][CSV_INDEX_CALC_TYPE] == QUALTYPE_TEXT){
			if(csv[i][CSV_INDEX_R] != ""){
				//csv[i][CSV_INDEX_CALC_SENTIMENT] = (((sentiment.parse(csv[i][CSV_INDEX_R])||{}).comparative||0) + 1.0) / 2.0;
				csv[i][CSV_INDEX_CALC_SENTIMENT] = ((sentiment.parse(csv[i][CSV_INDEX_R])||{}).comparative||0);
			}else{
				csv[i][CSV_INDEX_CALC_SENTIMENT] = -999; // this doesn't actually get used. Since it's out of bounds, we can ignore it later.
			}
		}else{
			csv[i][CSV_INDEX_CALC_SENTIMENT] = -999;
		}
	}
}]);
p.push(["Analyzing sentiment [overall]", function(){
	var allSentiments = [];
	for(var i=0; i<csv.length; i++){
		if(csv[i][CSV_INDEX_CALC_TYPE] == QUALTYPE_TEXT && csv[i][CSV_INDEX_CALC_SENTIMENT] >= -1){
			allSentiments.push(csv[i][CSV_INDEX_CALC_SENTIMENT]);
		}
	}
	// --
	csvStats.globalSentiment 			= getStatsFromArray(allSentiments, QUALTYPE_TEXT, {});
	csvStats.globalSentiment.v 		= allSentiments;
	csvStats.globalSentiment.type = QUALTYPE_TEXT;
}]);
p.push(["Calculating data stats", function(){
	var qs 	= {};
	// --
	for(var i=0; i<csv.length; i++){
		var q = csv[i][CSV_INDEX_Q];
		qs[q] = qs[q]||{q:q, v:[], type:csv[i][CSV_INDEX_CALC_TYPE], e:{}};
		if(csv[i][CSV_INDEX_CALC_TYPE] == QUALTYPE_TEXT){
			if(csv[i][CSV_INDEX_CALC_SENTIMENT] >= -1) qs[q].v.push(csv[i][CSV_INDEX_CALC_SENTIMENT]);
		}else{
			if(csv[i][CSV_INDEX_CALC_TYPE] == QUALTYPE_NUMBER){
				if(!isNaN(csv[i][CSV_INDEX_R])) qs[q].v.push(csv[i][CSV_INDEX_R]);
			}else{
				if(csv[i][CSV_INDEX_R].length>0){
					var subenums = csv[i][CSV_INDEX_R].split("|");
					for(var e=0; e<subenums.length; e++){
						qs[q].e[subenums[e]] = (qs[q].e[subenums[e]]||0)+1;
					}
				}
			}
		}
	}
	// --
	_.each(qs, function(val, key){
		qs[key] = $.extend(qs[key], getStatsFromArray(val.v, val.type, val.e));
	});
	// --
	csvStats.qs = qs;
	var qsArr = [];
	_.each(qs, function(val, key){
		qsArr.push(val);
	});
	// --
	var typesOrder = {};
	typesOrder[QUALTYPE_TEXT]    = 0;
	typesOrder[QUALTYPE_NUMBER]  = 1;
	typesOrder[QUALTYPE_ENUM] 	 = 2;
	typesOrder[QUALTYPE_UNKNOWN] = 3;
	// --
	qsArr.sort(function(a,b){
		if(a.type != b.type){
			return typesOrder[a.type] - typesOrder[b.type];
		}else{
			// sort by percent as it will be drawn.
			return (b.mean-b.drawmin)/(b.drawmax-b.drawmin) - (a.mean-a.drawmin)/(a.drawmax-a.drawmin);
		}
	});
	// --
	csvStats.qsArr = qsArr;
}]);
// --
function getAllCSVRowsWithRText(text){
	var intxtarr = (text||"").toLowerCase().match(REGEXP_MATCH_WORDS_CLEAN);
	// --
	var matchingRows = [];
	for(var i=0; i<csv.length; i++){
		var row = csv[i];
		if(csv[i][CSV_INDEX_CALC_TYPE] == QUALTYPE_TEXT){
			var t2  = (csv[i][CSV_INDEX_R]||"").toLowerCase();
			var t2s = t2.match(REGEXP_MATCH_WORDS_CLEAN)||[];
			for(var k=0; k<t2s.length-intxtarr.length; k++){
				var match = true;
				for(var m=0; m<intxtarr.length; m++){
					if(t2s[k+m] != intxtarr[m]){
						match = false;
						break;
					}
				}
				if(match){
					matchingRows.push(i);
					break;
				}
			}
		}
	}
	return matchingRows;
}
function getAllCSVRowsWithQ(q){
	var matchingRows = [];
	for(var i=0; i<csv.length; i++){
		if(csv[i][CSV_INDEX_Q] == q){
			matchingRows.push(i);
		}
	}
	//console.log(matchingRows);
	return matchingRows;
}
function getCleanHighlightedHTMLFromRText(rtxt, phrase){
	var rtxtHTML  = escapeHTML((rtxt||"").replace(/\s\|\s/g, ". "));
	var rtxtlower = (rtxtHTML||"").toLowerCase();
	var rtxtarr 	= rtxtlower.match(REGEXP_MATCH_WORDS_CLEAN)||[];
	phrase = (phrase||"").toLowerCase();
	var phrasearr = escapeHTML(phrase).match(REGEXP_MATCH_WORDS_CLEAN)||[];
	// --
	if(phrase.length > 0){
		var startindex 	= 0;
		var lastStartK 	= 0;
		var endK = rtxtarr.length-phrasearr.length+1;
		var placedHighlights = 0;
		while(lastStartK < endK){
			for(var k=lastStartK; k<endK; k++){
				var match = true;
				for(var m=0; m<phrasearr.length; m++){
					if(rtxtarr[k+m] != phrasearr[m]){
						match = false;
						break;
					}
				}
				lastStartK = k;
				// --
				if(match) break;
				// --
				startindex += rtxtarr[k].length+1;
			}
			if(k>=endK) break; // no match was found.
			// --
			var start = -1;
			var end   = -1;
			for(var i=phrase.length-1; i>0; i--){
				var hit = rtxtlower.indexOf(phrase.substring(0,i), startindex);
				if(hit >= 0){
					start = hit;
					break;
				}
			}
			if(start > -1){
				for(var i=0; i<phrase.length; i++){
					var hit = rtxtlower.indexOf(phrase.substring(i), startindex);
					if(hit >= 0){
						end = hit+phrase.substring(i).length;
						break;
					}
				}
			}
			// --
			if(start > -1 && end > start){
			
				var highlightExtraLen = ("<div class='highlight'>"+"</div>").length;
				var prevHShift = placedHighlights*highlightExtraLen;
				//console.log("Found original text! >> "+rtxtHTML.substring(start+prevHShift,end+prevHShift));
				rtxtHTML = rtxtHTML.substring(0,start+prevHShift)+"<div class='highlight'>"+rtxtHTML.substring(start+prevHShift,end+prevHShift)+"</div>"+rtxtHTML.substring(end+prevHShift);
				placedHighlights++;
			}else{
				if((phrase||"").length > 0) console.log("Couldn't find matching search text.", start, end);
			}
			// --
			for(var m=0; m<phrasearr.length; m++){
				startindex += rtxtarr[lastStartK++].length;
			}
		}
	}
	// --
	return rtxtHTML;
}

// -------
// RENDER
// -------
function htmlGetLogActions(){
	var html = "";
	html += "Total Rows: "+csv.length+" | <span style='cursor: pointer;' onclick='saveModifiedCSV();'>Save Modified CSV</span>";
	return html;
	logactions
}
// --
function htmlTopWords(){
	var html = "<div class='outsect'><h2>Top Words</h2>";
	for(var i=0; i<30 && i<csvStats.wordFreq.length; i++){
		var obj = csvStats.wordFreq[i];
		html += "<div class='phrase' onclick='diveIntoWord(\""+obj.t.replace(/\'/g,"&apos;")+"\");'><span class='num'>"+obj.o+"</span> "+escapeHTML(obj.t)+"</div>";
	}
	html += "</div>";
	return html;
}
function htmlTopPhrases(){
	var html = "<div class='outsect'><h2>Top Phrases</h2>";
	for(var i=0; i<30 && i<csvStats.phraseFreq.length; i++){
		var obj = csvStats.phraseFreq[i];
		html += "<div class='phrase' onclick='diveIntoPhrase(\""+obj.t.replace(/\'/g,"&apos;")+"\",false,true);'><span class='num p'>"+obj.o+"</span> "+escapeHTML(obj.t)+"</div>";
	}
	html += "</div>";
	return html;
}
function htmlAllQs(){
	var html = "";
	// --
	// overall sentiment
	var q = csvStats.globalSentiment;
	html += "<div class='outsect stats qual global'>";
	html += "<div id='outq_boxplot_globalsentiment' class='outq_boxplot'></div>";
	html += "<div class='question'>Overall Text Sentiment</div>";
	html += "<div class='comment'>Sentiment is a measure of the positive or negative nature of the qualitative text, from -1.0 to 1.0.</div>";
	html += "<div class='mean'>"+q.mean.toFixed(2)+"</div>";
	html += "<div class='samples'>"+q.len+" <span>samp.</span></div>";
	html += "</div>";
	// --
	for(var i=0; i<csvStats.qsArr.length; i++){
		var q = csvStats.qsArr[i];
		switch(q.type){
		case QUALTYPE_UNKNOWN:
			html += "<div class='outsect stats unknown' id='qdatasect_"+i+"'>";
			html += "<div class='mean'>---</div>";
			html += "<div class='question'>"+escapeHTML(q.q)+"</div>";
			html += "<div class='samples'>"+q.len+" <span>samp.</span></div>";
			html += "</div>";
			break;
		case QUALTYPE_ENUM:
			html += "<div class='outsect stats enum' id='qdatasect_"+i+"' onclick='exploreQData("+i+");'>";
			html += "<div id='outq_enum_"+i+"' class='outq_enum'></div>";
			html += "<div class='question'>"+escapeHTML(q.q)+"</div>";
			html += "<div class='top5'>";
			var enumcount = _.size(q.enums);
			var used = 0;
			for(var e=0; e<4; e++){
				var occurs = ((q.enums[e]||{}).o||0);
				if(occurs > 0){
					html += "<div class='enumname'>"+((q.enums[e]||{}).n||"---")+
						"<div class='enumoccur'>"+occurs+"</div>"+
						"<div class='enumbar'><div style='width:"+(100*occurs / q.drawmax)+"%'></div></div>"+
						"</div>";
					used += occurs;
				}
			} 
			if(enumcount > 4){
				html += "<div class='enumname'><span>+ "+(enumcount-4)+
					" other response types...</span><div class='enumoccur'><span>"+
					(q.len-used)+"</span></div></div>";
			}
			html += "</div>";
			html += "</div>";
			break;
		default:
			html += "<div class='outsect stats"+(q.type==QUALTYPE_TEXT?" qual":" numeric")+"' id='qdatasect_"+i+"' onclick='exploreQData("+i+");'>";
			html += "<div id='outq_boxplot_"+i+"' class='outq_boxplot'></div>";
			html += "<div class='question'>"+escapeHTML(q.q)+"</div>";
			html += "<div class='mean'>"+q.mean.toFixed(2)+"</div>";
			html += "<div class='samples'>"+q.len+" <span>samp.</span></div>";
			html += "</div>";
		}
	}
	return html;
}
// --
function htmlRenderAll(){
	$("#logactions").html(htmlGetLogActions());
	// --
	$("#output").html("");
	$("#output").append("<div id='topstats'>"+htmlTopWords()+htmlTopPhrases()+"</div>");
	// --
	$("#output").append("<div id='diveword'></div>");
	$("#output").append("<div id='divephrase'></div>");
	// --
	if(csvStats.wordFreq.length > 0) diveIntoWord(csvStats.wordFreq[0].t);
	// --
	//$("#output").append(htmlGlobalSentiment()+"<br/>");
	// --
	$("#output").append(htmlAllQs());
	// --
	d3Viz_BoxPlots();
}
// --
function d3Viz_BoxPlots(){
	var margin = {top: 10, right: 15, bottom: 10, left: 15};
	var width  = 210;
	var height = 60;
	// --
	// Returns a function to compute the interquartile range.
	function d3_iqr(k) {
	  return function(d, i) {
	    var q1 = d.quartiles[0],
	        q3 = d.quartiles[2],
	        iqr = (q3 - q1) * k,
	        i = -1,
	        j = d.length;
	    while (d[++i] < q1 - iqr);
	    while (d[--j] > q3 + iqr);
	    return [i, j];
	  };
	}
	// --
	for(var i=0; i<csvStats.qsArr.length; i++){
		var q = csvStats.qsArr[i];
		if(q.type == QUALTYPE_ENUM) continue;
		// --
		var chart = d3.hbox()
		    .whiskers(d3_iqr(1.5)) // 1.5 is what this should be to display outliers
				.domain([q.drawmin,q.drawmax])
		    .width(width)
			.height(height);
		// --
		var svg = d3.select("#outq_boxplot_"+i).selectAll("svg")
		      .data([q.v])
		    .enter().append("svg")
		      .attr("class", "boxplot")
		      .attr("width", width + margin.left + margin.right)
		      .attr("height", height + margin.bottom + margin.top)
		    .append("g")
		      .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
					.call(chart);
	}
	// --
	// overall sentiment
	var q = csvStats.globalSentiment;
	var chart = d3.hbox()
	    .whiskers(d3_iqr(1.5)) // 1.5 is what this should be to display outliers
			.domain([q.drawmin,q.drawmax])
	    .width(width)
		.height(height);
	// --
	var svg = d3.select("#outq_boxplot_globalsentiment").selectAll("svg")
	      .data([q.v])
	    .enter().append("svg")
	      .attr("class", "boxplot")
	      .attr("width", width + margin.left + margin.right)
	      .attr("height", height + margin.bottom + margin.top)
	    .append("g")
	      .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
				.call(chart);
}
// --
function onD3WordSel(el){
	$("#diveword svg [issel=selected]").attr("issel",null);
	$(el).attr("issel","selected");
}
function diveIntoWord(word){
	console.log("dive into word: "+word);
	//openDiveView();
	// --
	var width 	= Math.min(768, $("#diveword").width()||100);
	var height 	= 300; //$("#diveword").height()||100;
	var w = csvStats.wtree[word]||{};
	var duration = 250;
	$("#diveword").css("opacity", 1.0);
	// --
	d3.select("#diveword").selectAll('svg').remove();
	// --
	var svg = d3.select("#diveword").selectAll("svg")
	.data([[w.b, {t:w.t, o:w.o}, w.a]]).enter()
	.append("svg").attr("class", "wordtree").attr("width", width).attr("height", height);
	// --
	var g = svg.append("g");
	// --
	var cx = width/2;
	var cy = height/2;
	var maxtoshow = 12;
	if("BeforeWords"){
		var willshow = Math.min(maxtoshow, w.b.length);
		for(var i=0; i<willshow; i++){
			var g2 = g.append("g").attr("class","wordcon")
			.attr("onclick","onD3WordSel(this); diveIntoPhrase(\""+(w.b[i].t+" "+w.t)+"\");");
			// --
			var wx = 0;
			var wy = (i+0.5) * height/willshow;
			// --
			g2.append("path").attr("class", "wordpath before")
			.attr("d","M "+wx+" "+wy+
				" C "+(0.5*wx+0.5*cx)+" "+wy+
				" "+(wx+cx)/2+" "+wy+
				" "+cx+" "+cy)
			.style("stroke-width", Math.min(30, Math.max(10, Math.sqrt(w.b[i].o-1)*16)))
			// --
			g2.append("text").attr("class", "wordtxt")
			.attr("x", wx+30).attr("y", wy + 5)
			.attr("text-anchor","left").text(w.b[i].t);
			// --
			g2.append("text").attr("class", "wordtxt2")
			.attr("x", wx+15).attr("y", wy + 5)
			.attr("text-anchor","middle").text(w.b[i].o);
		}
	}
	if("AfterWords"){
		var willshow = Math.min(maxtoshow, w.a.length);
		for(var i=0; i<willshow; i++){
			var g2 = g.append("g").attr("class","wordcon")
			.attr("onclick","onD3WordSel(this); diveIntoPhrase(\""+(w.t+" "+w.a[i].t)+"\");");
			// --
			var wx = width;
			var wy = (i+0.5) * height/willshow;
			// --
			g2.append("path").attr("class", "wordpath after")
			.attr("d","M "+wx+" "+wy+
				" C "+(0.5*wx+0.5*cx)+" "+wy+
			" "+(wx+cx)/2+" "+wy+
				" "+cx+" "+cy)
			.style("stroke-width", Math.min(50, Math.max(12, Math.sqrt(w.a[i].o-1)*20)))
			
			// --
			g2.append("text").attr("class", "wordtxt")
			.attr("x", wx-30).attr("y", wy + 5)
			.attr("text-anchor","end").text(w.a[i].t);
			// --
			g2.append("text").attr("class", "wordtxt2")
			.attr("x", wx-15).attr("y", wy + 5)
			.attr("text-anchor","middle").text(w.a[i].o);
		}
	}
	if("MidWord + Dot"){
		var g2 = g.append("g").attr("class","midword selected")
		.attr("onclick","onD3WordSel(this); diveIntoPhrase(\""+w.t+"\");");
		// -- 
		g2.append("circle").attr("class", "midworddot")
		.attr("r", 47).attr("cx", cx).attr("cy", cy)
		.transition().duration(duration)
		.attr("r", 50);
		// --
		g2.append("text").attr("class", "midwordtxt")
		.attr("x", cx).attr("y", cy + 5)
		.attr("text-anchor","middle").text(w.t);
	}
	// --
	diveIntoPhrase(w.t);
}
var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
var lastDivePhrase = "";
function diveIntoPhrase(phrase, showall, dimword){
	lastDivePhrase = phrase;
	// --
	$("#diveword").css("height", dimword?"0px":"320px");
	// --
	var matchRows = getAllCSVRowsWithRText(phrase);
	//console.log("diving into phrase: "+phrase, matchRows);
	// --
	var html = "<div class='phrasetitle'>"+escapeHTML(phrase)+"</div>";
	// --
	var maxtoshow = showall?99999:7;
	var i = 0;
	for(i=0; i<matchRows.length && i<maxtoshow; i++){
		var d = csv[matchRows[i]][CSV_INDEX_DATE];
		// --
		var s = csv[matchRows[i]][CSV_INDEX_CALC_SENTIMENT]||0;
		var hue = Math.min(90, Math.max(0, 45 + s*500));
		var sat = Math.min(100, Math.max(15, 15 + Math.abs(s)*500));
		var sentimentColor = "hsl("+hue+","+sat+"%,48%)";
		html += "<div class='responsequote' style='border-color:"+sentimentColor+";'>";
		html += 	"<div class='question' title='question'>"+escapeHTML(csv[matchRows[i]][CSV_INDEX_Q])+"</div>";
		html += 	getCleanHighlightedHTMLFromRText(csv[matchRows[i]][CSV_INDEX_R], phrase);
		html += 	"<div class='meta'>";
		html += 		"<div class='metaform' title='form'>"+escapeHTML(csv[matchRows[i]][CSV_INDEX_FORM])+"</div>";
		html +=			"<div class='metauser' title='user'>"+escapeHTML(csv[matchRows[i]][CSV_INDEX_USER])+"</div>";		
		html += 		"<div class='metadate' title='date'>"+MONTHS[d.getMonth()]+". "+d.getDate()+", "+d.getFullYear()+"</div>";
		html += 	"</div>";
		html += "</div>";
	}
	if(i < matchRows.length){
		html += "<div class='theresmore' onclick='diveIntoPhrase(lastDivePhrase, true);'>+ "+(matchRows.length-i)+" more responses...</div>";
	}
	// --
	$("#divephrase").html(html);
}
var lastExploredIndex = -1;
function closeExplorerIfOpen(){
	$("#dataexplorer").remove();
	$(".outsect").removeClass("exploring");
	lastExploredIndex = -1;
}
function exploreQData(qindex, showall){
	//console.log("Explore data... "+qindex);
	var qs = csvStats.qsArr[qindex];
	// --
	// close the word viewer and phrase viewer when using the data explorer.
	$("#diveword").css("height", "0px");
	$("#divephrase").html("");
	// --
	if(lastExploredIndex == qindex) return closeExplorerIfOpen();
	closeExplorerIfOpen();
	lastExploredIndex = qindex;
	// ----
	if(qs.type == QUALTYPE_TEXT){
		$("#qdatasect_"+qindex).addClass("exploring");
		//console.log(qs);
		var matchRows = getAllCSVRowsWithQ(qs.q);
		var html = "<div id='dataexplorer'>";
		//html += "<div class='questiontitle'>"+escapeHTML(qs.q)+"</div>";
		// --
		//console.log("Matching rows: "+matchRows.length);
		var maxtoshow = showall?99999:7;
		var i = 0;
		for(i=0; i<matchRows.length && i<maxtoshow; i++){
			var d = csv[matchRows[i]][CSV_INDEX_DATE];
			// --
			if(csv[matchRows[i]][CSV_INDEX_CALC_TYPE] == QUALTYPE_TEXT){
				var s = csv[matchRows[i]][CSV_INDEX_CALC_SENTIMENT]||0;
				var hue = Math.min(90, Math.max(0, 45 + s*500));
				var sat = Math.min(100, Math.max(15, 15 + Math.abs(s)*500));
				var sentimentColor = "hsl("+hue+","+sat+"%,48%)";
		 		html += "<div class='responsequote' style='border-color:"+sentimentColor+";'>";
		 		html += 	"<div class='question' title='question'>"+escapeHTML(csv[matchRows[i]][CSV_INDEX_Q])+"</div>";
		 		html += 	getCleanHighlightedHTMLFromRText(csv[matchRows[i]][CSV_INDEX_R], "");
		 		html += 	"<div class='meta'>";
		 		html += 		"<div class='metaform' title='form'>"+escapeHTML(csv[matchRows[i]][CSV_INDEX_FORM])+"</div>";
		 		html +=			"<div class='metauser' title='user'>"+escapeHTML(csv[matchRows[i]][CSV_INDEX_USER])+"</div>";
		 		html += 		"<div class='metadate' title='date'>"+MONTHS[d.getMonth()]+". "+d.getDate()+", "+d.getFullYear()+"</div>";
		 		html += 	"</div>";
		 		html += "</div>";
			}
		}
		if(i < matchRows.length){
		 	html += "<div class='theresmore' onclick='lastExploredIndex=-1; exploreQData("+qindex+", true);'>+ "+(matchRows.length-i)+" more responses...</div>";
		}
		// --
		html += "</div>";
		$(html).insertAfter("#qdatasect_"+qindex);
	}
	// ----
	if(qs.type == QUALTYPE_ENUM){
		$("#qdatasect_"+qindex).addClass("exploring");
		//console.log(qs);
		// --
		var html = "<div id='dataexplorer'>";
		// --
		html += "<div class='enums'>";
		var enums = qs.enums||[];
		for(var i=0; i<enums.length; i++){
			var occurs = ((enums[i]||{}).o||0);
			if(occurs > 0){
				html += "<div class='enumname'>"+((qs.enums[i]||{}).n||"---")+
					"<div class='enumoccur'>"+occurs+"</div>"+
					"<div class='enumbar'><div style='width:"+(100*occurs / qs.drawmax)+"%'></div></div>"+
					"</div>";
			}
		}
		html += "</div>";
		// --
		html += "</div>";
		$(html).insertAfter("#qdatasect_"+qindex);
		// --
	}
}


