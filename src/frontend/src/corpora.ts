// Bootstrap and bootstrap-select augment jquery
import 'bootstrap';
import 'bootstrap-select';

// Whereas these register new highlighters for codemirror
import 'codemirror/mode/javascript/javascript.js';
import 'codemirror/mode/yaml/yaml.js';

import './utils/features/tutorial';

// Now import the augmented modules (though import order shouldn't matter)
import CodeMirror from 'codemirror';
import * as $ from 'jquery';
import * as Mustache from 'mustache';

import * as BLTypes from './types/blacklabtypes';

const enum DataEvent {
	SERVER_REFRESH = 'server/refresh',
	FORMATS_REFRESH = 'formats/refresh',
	CORPORA_REFRESH = 'corpora/refresh', // all corpora
	CORPUS_REFRESH = 'corpus/refresh' // single corpus
}

interface DataEventPayloadMap {
	[DataEvent.SERVER_REFRESH]: BLTypes.BLServer;
	[DataEvent.FORMATS_REFRESH]: BLTypes.NormalizedFormat[];
	[DataEvent.CORPORA_REFRESH]: BLTypes.NormalizedIndex[];
	[DataEvent.CORPUS_REFRESH]: BLTypes.NormalizedIndex;
}

// (Private) corpora management page.
//
// Show a list of public and private corpora;
// Allows user to create and delete private corpora
// and add data to them.

// blacklab-server url
let blsUrl: string;
// Contains the full list of available corpora
let corpora: BLTypes.NormalizedIndex[] = [];
// Contains the full list of available formats
let formats: BLTypes.NormalizedFormat[] = [];
// Serverinfo, contains user information etc
let serverInfo: BLTypes.BLServer;

const $root = $(document);
function createTrigger<K extends keyof DataEventPayloadMap>(eventType: K, $target = $root) {
	return function(payload: DataEventPayloadMap[K]) {
		// need to wrap payload in array to prevent jquery from unpacking it into multiple arguments on the receiving side
		$target.trigger(eventType, [payload]);
	};
}

function createHandler<K extends keyof DataEventPayloadMap>({selector, event, handler}: {selector?: string,event: K,handler: (payload: DataEventPayloadMap[K]) => void}) {
	const $elements = selector ? $(selector) : undefined;

	$root.on(event, function(jqEvent, payload) {
		if ($elements) {
			$elements.each(function() {
				handler.call($(this), payload);
			});
		} else {
			handler.call(undefined, payload);
		}
	});
}

function createHandlerOnce<K extends keyof DataEventPayloadMap>({selector, event, handler}: {selector?: string, event: K, handler: (payload: DataEventPayloadMap[K]) => void}) {
	const $elements = selector ? $(selector) : undefined;

	$root.one(event, function(jqEvent, payload) {
		if ($elements) {
			$elements.each(function() {
				handler.call($(this), payload);
			});
		} else {
			handler.call(undefined, payload);
		}
	});
}

const triggers = {
	updateFormats: createTrigger(DataEvent.FORMATS_REFRESH),
	updateServer: createTrigger(DataEvent.SERVER_REFRESH),
	updateCorpora: createTrigger(DataEvent.CORPORA_REFRESH),
	updateCorpus: createTrigger(DataEvent.CORPUS_REFRESH)
};

// Attach these handlers first, so that we can store data before other handlers run
createHandler({event: DataEvent.SERVER_REFRESH, handler(payload) { serverInfo = Object.assign({}, payload); }});
createHandler({event: DataEvent.CORPORA_REFRESH, handler(payload) { corpora = [].concat(payload); }});
createHandler({event: DataEvent.FORMATS_REFRESH, handler(payload) { formats = [].concat(payload); }});
createHandler({event: DataEvent.CORPUS_REFRESH, handler(payload) {
	payload = Object.assign({}, payload);
	// merge into list, trigger global corpora refresh
	const i = corpora.findIndex(function(corpus) { return corpus.id === payload.id; });
	i >= 0 ? corpora[i] = payload : corpora.push(payload);
	triggers.updateCorpora(corpora);
}});

createHandler({event: DataEvent.SERVER_REFRESH, handler(newServerInfo) {
	// Don't hide when !canCreateIndex, user may have just hit the limit
	// (in this case it should be unhidden when a private corpus exists)
	if (newServerInfo.user.canCreateIndex) {
		$('#corpora-private-container').show();
	}

	$('#create-corpus').toggle(newServerInfo.user.canCreateIndex);
	$('#create-corpus-limited').toggle(!newServerInfo.user.canCreateIndex);
	$('#formats-all-container').toggle(newServerInfo.user.loggedIn);
}});

createHandler({event: DataEvent.CORPORA_REFRESH, handler(newCorpora) {
	if (newCorpora.find(function(corpus) { return !corpus.owner; }) != null) {
		$('#corpora-public-container').show();
	}

	if (newCorpora.find(function(corpus) { return !!corpus.owner; }) != null) {
		$('#corpora-private-container').show();
	}
}});

createHandlerOnce({selector: '*[data-autoupdate="username"]', event: DataEvent.SERVER_REFRESH, handler(newServerInfo) {
	this.show().html(newServerInfo.user.loggedIn ? 'Logged in as <em>'+newServerInfo.user.id+'</em>' : 'Not logged in');
}});

createHandler({selector: 'tbody[data-autoupdate="format"]', event: DataEvent.FORMATS_REFRESH, handler(newFormats) {
	// Always show user's own formats, even if isVisible == false
	newFormats = newFormats.filter(f => f.owner === serverInfo.user.id);

	const template =
	'{{#formats}}'+
	'<tr>'+
		'<td>{{shortId}}</td>'+
		'<td>{{displayName}}</td>'+
		'<td><a data-format-operation="edit" class="fa fa-pencil" data-format-id="{{id}}" title="Edit format \'{{displayName}}\'" href="javascript:void(0)"></a></td>'+
		'<td><a data-format-operation="delete" class="fa fa-trash" data-format-id="{{id}}" title="Delete format \'{{displayName}}\'" href="javascript:void(0)"></a></td>'+
	'</tr>'+
	'{{/formats}}';

	this.html(Mustache.render(template, {
		formats: newFormats,
	}));
}});

createHandler({selector: 'select[data-autoupdate="format"]', event: DataEvent.FORMATS_REFRESH, handler(newFormats) {
	const showNonConfigBased = this.data('filter') !== 'configBased';

	newFormats = newFormats.filter(function(format) {
		return showNonConfigBased || format.configurationBased;
	});

	const template =
	'<optgroup label="Presets">' +
		'{{#builtinFormats}}' +
		'<option title="{{displayName}}" value="{{id}}" data-content="{{displayName}} <small>({{shortId}})</small>">{{displayName}}</option>' +
		'{{/builtinFormats}}' +
	'</optgroup>' +
	'<optgroup label="{{userName}}">' +
		'{{#userFormats}}' +
		'<option title="{{displayName}}" value="{{id}}" data-content="{{displayName}} <small>({{shortId}})</small>">{{displayName}}</option>' +
		'{{/userFormats}}' +
	'</optgroup>';

	this
		.html(Mustache.render(template, {
			userName: serverInfo.user.id,
			builtinFormats: newFormats.filter(f => !f.owner && f.isVisible == null /* temporary, for when bls does not support the property yet */ || f.isVisible),
			userFormats: newFormats.filter(f => !!f.owner) // Always show user's own formats, even if isVisible == false
		}))
		.selectpicker('refresh')
		.trigger('change');
}});

createHandler({selector: 'tbody[data-autoupdate="corpora"]', event: DataEvent.CORPORA_REFRESH, handler(newCorpora) {
	const filter = this.data('filter');

	if (filter === 'public') {
		newCorpora = newCorpora.filter(corpus => !corpus.owner);
	} else if (filter === 'private') {
		newCorpora = newCorpora.filter(corpus => !!corpus.owner);
	}

	// generate some data we need for rendering
	const viewcorpora = newCorpora.map(function(corpus) {
		let statusText: string = corpus.status;
		if (statusText === 'indexing') {
			statusText = ' (indexing) - ' + corpus.indexProgress.filesProcessed + ' files, ' +
				corpus.indexProgress.docsDone + ' documents, and ' +
				corpus.indexProgress.tokensProcessed + ' tokens indexed so far...';
		} else if (corpus.status !== 'available') {
			statusText = ' (' + statusText + ')';
		} else  {
			statusText = '';
		}

		let pageURL = window.location.href;
		if (pageURL[pageURL.length-1] !== '/') {
			pageURL += '/';
		}

		const format = formats.find(f => f.id === corpus.documentFormat);

		return {
			...corpus,
			canSearch: corpus.status === 'available',
			documentFormatShortId: format ? format.shortId : '',
			documentFormatOwner: format ? format.owner : '',
			isUserFormat: format ? !!format.owner : false,
			isPrivate: !!corpus.owner,
			searchUrl: pageURL + corpus.id + '/search',
			sizeString: abbrNumber(corpus.tokenCount),
			statusText,
			timeModified: dateOnly(corpus.timeModified)
		};
	});

	const template =
	'{{#corpora}} \
	<tr> \
		<td><a title="Search the \'{{displayName}}\' corpus" class="icon fa fa-search {{^canSearch}}disabled{{/canSearch}}" {{#canSearch}}href="{{searchUrl}}"{{/canSearch}}></a></td> \
		<td class="corpus-name"><a title="Search the \'{{displayName}}\' corpus" class="{{^canSearch}}disabled{{/canSearch}}" {{#canSearch}}href="{{searchUrl}}"{{/canSearch}}>{{displayName}} {{status}}</a></td>\
		<td>{{sizeString}}</td>\
		{{#isPrivate}} \
			<td {{#isUserFormat}}title="Format owned by {{documentFormatOwner}}"{{/isUserFormat}}>{{#isUserFormat}}*{{/isUserFormat}}{{documentFormatShortId}}</td>\
			<td>{{timeModified}}</td>\
			<td><a data-corpus-action="upload" data-id="{{id}}" title="Upload documents to the \'{{displayName}}\' corpus" class="icon fa fa-plus-square {{#isBusy}}disabled{{/isBusy}}" href="javascript:void(0)"></a></td>\
			<td><a data-corpus-action="share" data-id="{{id}}" title="Share the \'{{displayName}}\' corpus" class="icon fa fa-user-plus" href="javascript:void(0)"></a></td>\
			<td><a data-corpus-action="delete" data-id="{{id}}" title="Delete the \'{{displayName}}\' corpus" class="icon fa fa-trash {{#isBusy}}disabled{{/isBusy}}" href="javascript:void(0)"></a></td> \
		{{/isPrivate}} \
	</tr>\
	{{/corpora}}';

	this.html(Mustache.render(template, {
		corpora: viewcorpora
	}));
}});

$('#corpora-private-container').on('click', '*[data-corpus-action="delete"]:not(.disabled)', function deleteCorpus(event) {
	event.preventDefault();
	event.stopPropagation();

	const $this = $(event.target);
	const corpusId = $this.data('id');
	const corpus = corpora.find(c => c.id === corpusId);
	if (corpus == null) {
		return;
	}

	confirmDialog(
		'Delete corpus?',
		'You are about to delete corpus <b>' + corpus.displayName + '</b>. <i class="text-danger">This cannot be undone!</i> <br><br>Are you sure?',
		'Delete',
		function ok() {
			$('#waitDisplay').show();

			$.ajax(blsUrl + corpusId, {
				type: 'DELETE',
				accepts: {json: 'application/json'},
				dataType: 'json',
				success () {
					$('#waitDisplay').hide();
					showSuccess('Corpus "' + corpus.displayName + '" deleted.');
					refreshCorporaList();
				},
				error: showXHRError('Could not delete corpus "' + corpus.displayName + '"', function() {
					$('#waitDisplay').hide();
				})
			});

		}
	);
});

$('#corpora-private-container').on('click', '*[data-corpus-action="upload"]:not(.disabled)', function showUploadForm(event) {
	event.preventDefault();
	event.stopPropagation();
	const $this = $(event.target);
	const corpusId = $this.data('id');
	const corpus = corpora.find(c => c.id === corpusId);
	if (corpus == null) {
		return;
	}

	const format = formats.find(f => f.id === corpus.documentFormat);

	$('#uploadCorpusName').text(corpus.displayName);
	$('#uploadFormat').text(corpus.documentFormat + ' ');
	$('#uploadFormatDescription').text(format ? format.description : 'Unknown format (it may have been deleted from the server), uploads might fail');

	// clear selected files
	$('#document-upload-form input[type="file"]').each(function() { $(this).val(undefined); }).trigger('change');

	$('#uploadErrorDiv').hide();
	$('#uploadSuccessDiv').hide();
	$('.progress').hide();

	// finally show the modal
	uploadToCorpus = corpus; // global
	$('#upload-file-dialog').modal('show');
});

$('#corpora-private-container').on('click', '*[data-corpus-action="share"]:not(.disabled)', function shareCorpus(event) {
	event.preventDefault();
	event.stopPropagation();
	const $this = $(event.target);
	const corpusId = $this.data('id');
	const corpus = corpora.find(c => c.id === corpusId);
	if (corpus == null) {
		showError('Unknown corpus, please refresh the page.'); // should never happen (except maybe before page is fully loaded) but whatever
		return;
	}

	$.ajax(blsUrl + '/' + corpusId + '/sharing', {
		type: 'GET',
		accepts: {json: 'application/json' },
		dataType: 'json',
		cache: false,
		success (data) {
			$('#share-corpus-editor').val(data['users[]'].join('\n'));
			$('#share-corpus-form').data('corpus', corpus);
			$('#share-corpus-name').text(corpus.displayName);
			$('#share-corpus-modal').modal('show');
		},
		error: showXHRError('Could not retrieve share list'),
	});
});

$('#share-corpus-form').on('submit', function(event) {
	event.preventDefault();

	const corpus = $(this).data('corpus');
	const $modal = $('#share-corpus-modal');
	const $editor = $('#share-corpus-editor');
	const users = ($editor.val() as string).trim().split(/\s*[\r\n]+\s*/g); // split on line breaks, ignore empty lines.

	$.ajax(blsUrl + '/' + corpus.id + '/sharing/', {
		type: 'POST',
		accepts: {json: 'application/json'},
		dataType: 'json',
		data: {
			'users[]': users,
		},
		success (data) {
			showSuccess(data.status.message);
		},
		error: showXHRError('Could not share corpus "' + corpus.displayName + '"'),
		complete () {
			$editor.val(undefined);
			$modal.modal('hide');
		}
	});
});

// Abbreviate a number, i.e. 3426 becomes 3,4K,
// 2695798 becomes 2,6M, etc.
function abbrNumber(n) {
	if (n === undefined) {
		return '';
	}
	let unit = '';
	if (n >= 1e9) {
		n = Math.round(n / 1e8) / 10;
		unit = 'G';
	} else if (n >= 1e6) {
		n = Math.round(n / 1e5) / 10;
		unit = 'M';
	} else if (n >= 1e3) {
		n = Math.round(n / 1e2) / 10;
		unit = 'K';
	}
	return String(n).replace(/\./, ',') + unit;
}

// Return only the date part of a date/time string,
// and flip it around, e.g.:
// "1970-02-01 00:00:00" becomes "01-02-1970"
function dateOnly(dateTimeString) {
	if (dateTimeString) {
		return dateTimeString.replace(/^(\d+)-(\d+)-(\d+) .*$/, '$3-$2-$1');
	} else {
		return '01-01-1970';
	}
}

/**
 * Keep requesting the status of the current index until it's no longer indexing.
 * The update handler will be called periodically while the status is "indexing", and then once more when the status has changed to something other than "indexing".
 *
 * @param {string} indexId full id including any username
 */
function refreshIndexStatusWhileIndexing(indexId) {
	const statusUrl = blsUrl + indexId + '/status/';

	let timeoutHandle;

	function success(index) {
		triggers.updateCorpus(normalizeIndex(index, indexId));

		if (index.status !== 'indexing') {
			clearTimeout(timeoutHandle);
		} else {
			setTimeout(run, 2000);
		}
	}

	function run() {
		$.ajax(statusUrl, {
			type: 'GET',
			accepts: {json: 'application/json'},
			dataType: 'json',
			success,
			error: showXHRError(
				'Could not retrieve status for corpus "' + indexId.substr(indexId.indexOf(':')+1) + '"',
				function() {
					clearTimeout(timeoutHandle);
				}
			)
		});
	}

	timeoutHandle = setTimeout(run, 2000);
}

/**
 * Add some calculated properties to the index object (such as if it's a private index) and normalize some optional data to empty strings if missing.
 *
 * @param index the index json object as received from blacklab-server
 * @param indexId full id of the index, including username portion (if applicable)
 */

function normalizeIndex(index: BLTypes.BLIndex, id: string): BLTypes.NormalizedIndex {
	return {
		...index,

		id,
		owner: id.substring(0, id.indexOf(':')) || null,
		shortId: id.substr(id.indexOf(':') + 1),

		displayName: index.displayName || id.substr(id.indexOf(':') + 1),
		documentFormat: index.documentFormat || null,
		indexProgress: index.indexProgress || null,
		tokenCount: index.tokenCount == null ? null : index.tokenCount,
	};
}

/**
 * @param format as received from the server
 * @param formatId - full id of the format, including userName portion (if applicable)
 */
function normalizeFormat(format: BLTypes.BLFormat, id: string): BLTypes.NormalizedFormat {
	return {
		...format,

		id,
		owner: id.substring(0, id.indexOf(':')) || null,
		shortId: id.substr(id.indexOf(':') + 1),

		displayName: format.displayName || id.substr(id.indexOf(':') + 1),
		helpUrl: format.helpUrl || null,
		description: format.description || null,
	};
}

// Request the list of available corpora and
// update the corpora page with it.
function refreshCorporaList() {
	// Perform the AJAX request to get the list of corpora.
	$('#waitDisplay').show();
	$.ajax(blsUrl, {
		type: 'GET',
		accepts: {json: 'application/json'},
		dataType: 'json',
		success (data: BLTypes.BLServer) {
			const indices = $.map(data.indices, normalizeIndex);
			triggers.updateServer(data);
			triggers.updateCorpora(indices);
			indices
				.filter(function(corpus) { return corpus.status === 'indexing'; })
				.forEach(function(corpus) { refreshIndexStatusWhileIndexing(corpus.id); });
		},
		error: showXHRError('Could not retrieve corpora'),
		complete () {
			$('#waitDisplay').hide();
		}
	});
}

function refreshFormatList() {
	$.ajax(blsUrl + '/input-formats/', {
		type: 'GET',
		accepts: {json: 'application/json'},
		dataType: 'json',
		success (data: BLTypes.BLFormats) {
			triggers.updateServer($.extend({}, serverInfo, {
				user: data.user
			}));
			triggers.updateFormats(
				$.map(data.supportedInputFormats, normalizeFormat)
					.sort(function(a, b) {
						return a.displayName.localeCompare(b.displayName); // sort alphabetically by id
					})
			);
		},
		error: showXHRError('Could not retrieve formats'),
	});
}

// Get the currently logged-in user, or the empty string if no user is logged in.
function getUserId() {
	return serverInfo.user.loggedIn ? serverInfo.user.id : '';
}

// Show success message at the top of the page.
function showSuccess(msg: string) {
	$('#errorDiv').hide();
	$('#successMessage').html(msg);
	$('#successDiv').show();
	$('html, body').animate({
		scrollTop: $('#successDiv').offset().top - 75 // navbar
	}, 500);
}

// Show error at the top of the page.
function showError(msg: string) {
	$('#successDiv').hide();
	$('#errorMessage').html(msg).show();
	$('#errorDiv').show();
	$('html, body').animate({
		scrollTop: $('#errorDiv').offset().top - 75 // navbar
	}, 500);
}

function showXHRError(message: string, callback?: () => void) {
	return function(jqXHR, textStatus, errorThrown) {
		let errorMsg;

		if (jqXHR.readyState === 0) {
			errorMsg = 'Cannot connect to server.';
		} else if (jqXHR.readyState === 4) {
			const data = jqXHR.responseJSON;
			if (data && data.error) {
				errorMsg = data.error.message;
			} else { try { // not json? try xml.
				const xmlDoc = $.parseXML( jqXHR.responseText );
				const $xml = $( xmlDoc );
				errorMsg = $xml.find( 'error code' ).text() + ' - ' +  $xml.find(' error message ').text();
			} catch (error) {
				if (textStatus && errorThrown) {
					errorMsg = textStatus + ' - ' + errorThrown;
				} else {
					errorMsg = 'Unknown error.';
				}
			}
			}
		} else {
			errorMsg = 'Unknown error.';
		}

		showError(message + ': ' + errorMsg);
		if (typeof callback === 'function') {
			callback();
		}
	};
}

/**
 *  Create the specified index in the private user area.
 *
 *  @param displayName Name to show for the index
 *  @param shortName Internal, technical name that uniquely identifies the index for this user
 *  @param format Name of the format type for the documents in the index
 */
function createIndex(displayName: string, shortName: string, format: string) {
	if (shortName == null || shortName.length === 0) {
		return;
	}
	if (displayName == null) {
		return;
	}

	// Prefix the user name because it's a private index
	const indexName = getUserId() + ':' + shortName;

	// Create the index.
	$('#waitDisplay').show();
	$.ajax(blsUrl, {
		type: 'POST',
		accepts: {json: 'application/json'},
		dataType: 'json',
		data: {
			name: indexName,
			display: displayName,
			format
		},
		success (/*data*/) {
			refreshCorporaList();
			showSuccess('Corpus "' + displayName + '" created.');
		},
		error: showXHRError('Could not create corpus "' + shortName + '"'),
		complete () {
			$('#waitDisplay').hide();
		}
	});
}

createHandler({selector: '#uploadProgress', event: DataEvent.CORPORA_REFRESH, handler(newCorpora) {
	const displayedCorpusId = this.data('corpus-id');
	if (!displayedCorpusId) {
		return;
	}

	const corpus = newCorpora.find(c => c.id === displayedCorpusId);
	if (!corpus) {
		return;
	}

	let statusText = '';
	if (corpus.status === 'indexing') {
		statusText = 'Indexing in progress... - '
		+ corpus.indexProgress.filesProcessed + ' files, '
		+ corpus.indexProgress.docsDone + ' documents, and '
		+ corpus.indexProgress.tokensProcessed + ' tokens indexed so far...';
	} else {
		statusText = 'Finished indexing!';
		this.toggleClass('indexing', false);
	}
	this.text(statusText);
}});

// What corpus are we uploading data to?
// TODO not very tidy
let uploadToCorpus = null;

function initFileUpload() {

	const $modal = $('#upload-file-dialog');

	const $progress = $('#uploadProgress');
	const $success = $('#uploadSuccessDiv');
	const $error = $('#uploadErrorDiv');

	const $form = $('#document-upload-form');
	const $fileInputs = $form.find('input[type="file"]') as JQuery<HTMLInputElement>;

	$fileInputs.each(function() {
		const $this = $(this);
		$this.on('change', function() {
			let text;
			if (this.files && this.files.length) {
				text = this.files.length + $this.data('labelWithValue');
			} else {
				text = $this.data('labelWithoutValue');
			}

			$($this.data('labelId')).text(text);
		});
	}).trigger('change'); // init labels

	function preventModalCloseEvent(event) {
		event.preventDefault();
		event.stopPropagation();
		return false;
	}

	function handleUploadProgress(event) {
		const progress = event.loaded / event.total * 100;
		$progress
			.text('Uploading... (' +  Math.floor(progress) + '%)')
			.css('width', progress + '%')
			.attr('aria-valuenow', progress);

		if (event.loaded >= event.total) {
			handleUploadComplete.call(this, event);
		}
	}

	function handleUploadComplete(/*event*/) {
		$progress
			.css('width', '')
			.toggleClass('indexing', true)
			.text('indexing...')
			.data('corpus-id', uploadToCorpus.id);

		refreshIndexStatusWhileIndexing(uploadToCorpus.id);
	}

	function handleIndexingComplete(event) {
		if (this.status !== 200) {
			return handleError.call(this, event);
		}

		const message = 'Data added to "' + uploadToCorpus.displayName + '".';

		$modal.off('hide.bs.modal', preventModalCloseEvent);
		$modal.find('[data-dismiss="modal"]').attr('disabled', null).toggleClass('disabled', false);
		$progress.toggleClass('indexing', false).parent().hide();
		$form.show();
		$error.hide();
		$success.text(message).show();

		// clear values
		$fileInputs.each(function() {
			$(this).val(undefined).trigger('change');
		});
	}

	function handleError(/*event*/) {
		let msg = 'Could not add data to "' + uploadToCorpus.displayName + '"';
		if (this.responseText) {
			msg += ': ' + JSON.parse(this.responseText).error.message;
		} else if (this.textStatus) {
			msg += ': ' + this.textStatus;
		} else {
			msg += ': unknown error (are you trying to upload too much data?)';
		}

		$modal.off('hide.bs.modal', preventModalCloseEvent);
		$modal.find('[data-dismiss="modal"]').attr('disabled', null).toggleClass('disabled', false);
		$progress.toggleClass('indexing', false).parent().hide();
		$form.show();
		$success.hide();
		$error.text(msg).show();
	}

	$form.on('submit', function(event) {
		event.preventDefault();

		$modal.on('hide.bs.modal', preventModalCloseEvent);
		$modal.find('[data-dismiss="modal"]').attr('disabled', null).toggleClass('disabled', true);
		$form.hide();
		$error.hide();
		$success.hide();
		$progress
			.text('Connecting...')
			.css('width', '0%')
			.parent().show();

		const formData = new FormData();
		$fileInputs.each(function() {
			const self = this;
			$.each(this.files, function(index, file) {
				formData.append(self.name, file, file.name);
			});
		});

		const xhr = new XMLHttpRequest();

		xhr.upload.addEventListener('progress', handleUploadProgress.bind(xhr));
		xhr.upload.addEventListener('error', handleError.bind(xhr));
		xhr.upload.addEventListener('abort', handleError.bind(xhr));
		// Don't bother attaching event listener 'load' on xhr.upload - it's broken in IE and Firefox
		// Instead manually trigger uploadcomplete when we reach 100%
		xhr.addEventListener('load', handleIndexingComplete.bind(xhr));
		xhr.addEventListener('error', handleError.bind(xhr));
		xhr.addEventListener('abort', handleError.bind(xhr));

		xhr.open('POST', blsUrl + uploadToCorpus.id + '/docs?outputformat=json', true);
		xhr.send(formData);

		return false;
	});
}

function initNewCorpus() {
	const $newCorpusModal = $('#new-corpus-modal');
	const $corpusNameInput = $('#corpus_name');
	const $corpusFormatSelect = $('#corpus_document_type');
	const $corpusFormatDescription = $('#corpus_document_type_description');
	const $corpusFormatHelpUrl = $('#corpus_document_type_help_url');
	const $saveButton = $('#new-corpus-modal .btn-primary');

	$newCorpusModal.on('shown.bs.modal', function(/*event*/) {
		$corpusNameInput.val('');
		$saveButton.prop('disabled', true);
		$corpusNameInput[0].focus();
	});
	$corpusNameInput.on('change, input', function(/*event*/) {
		$saveButton.prop('disabled', ($(this).val() as string).length <= 2);
	});
	// Enable submit through pressing the 'enter' key while a form element has the focus
	$('input, select', $newCorpusModal).on('keydown', function(event) {
		if (event.keyCode === 13) {
			event.preventDefault();
			if (!$saveButton.prop('disabled')) {
				$saveButton.click();
			}
		}
	});
	$saveButton.on('click', function(event) {
		event.preventDefault();
		if ($(this).prop('disabled')) {
			return;
		}

		const corpusName = $corpusNameInput.val() as string;
		const format = $corpusFormatSelect.val() as string;
		$newCorpusModal.modal('hide');
		createIndex(corpusName, generateShortName(corpusName), format);
	});

	$corpusFormatSelect.on('changed.bs.select, refreshed.bs.select, loaded.bs.select, change', function() {
		const formatId = $(this).selectpicker('val');
		const format = formats.find(f => f.id === formatId);
		// format always exists if it's present in the select to begin with

		$corpusFormatDescription.text(format.description);
		$corpusFormatHelpUrl.attr('href', format.helpUrl || undefined).toggle(!!format.helpUrl);
	});
}

/**
 * Show a dialog with custom message, title, and confirm button html
 * Call a callback, only if the confirm button is pressed.
 *
 * @param {string} title
 * @param {string} message
 * @param {string} buttontext
 * @param {any} fnCallback
 */
const confirmDialog = (function() {
	const $modal = $('#modal-confirm');
	const $confirmButton = $modal.find('#modal-confirm-confirm');
	const $title = $modal.find('#modal-confirm-title');
	const $message = $modal.find('#modal-confirm-message');

	return function(title, message, buttontext, fnCallback) {
		$title.html(title);
		$message.html(message);
		$confirmButton.html(buttontext);

		$modal.modal('show');
		$modal.one('hide.bs.modal', function() {
			if (document.activeElement === $confirmButton[0]) {
				fnCallback();
			}
		});
	};
})();

function generateShortName(name) {
	return name.replace(/[^\w]/g, '-').replace(/^[_\d]+/, '');
}

function initNewFormat() {
	const $modal = $('#new-format-modal');

	const $fileInput = $('#format_file') as JQuery<HTMLInputElement>;
	const $presetSelect = $('#format_select');
	const $presetInput = $('#format_preset');
	const $downloadButton = $('#format_download');

	const $formatName = $('#format_name');
	const $formatType = $('#format_type');
	const editor = CodeMirror.fromTextArea($('#format_editor')[0], {
		mode: 'yaml',
		lineNumbers: true,
		matchBrackets: true,

		viewportMargin: 100 // render 100 lines above and below the visible editor window
	});

	const $confirmButton = $('#format_save');

	function showFormatError(text) {
		$('#format_error').text(text).show();
	}
	function hideFormatError() {
		$('#format_error').hide();
	}

	function uploadFormat(file) {
		const formData = new FormData();
		formData.append('data', file, file.name);

		$.ajax(blsUrl + '/input-formats/', {
			data: formData,
			processData: false,
			contentType: false,
			type: 'POST',
			accepts: {json: 'application/javascript'},
			dataType: 'json',
			success (data) {
				$modal.modal('hide');
				$formatName.val('');
				editor.setValue('');

				refreshFormatList();
				showSuccess(data.status.message);
			},
			error (jqXHR, textStatus/*, errorThrown*/) {
				showFormatError(jqXHR.responseJSON && jqXHR.responseJSON.error.message || textStatus);
			}
		});
	}

	$modal.on('shown.bs.modal', function() {
		// Required to fix line-number display width being calculated incorrectly
		// (something to do with initializing the editor when the element is invisible or has width 0)
		editor.refresh();
	});

	$modal.on('hidden.bs.modal', function() {
		hideFormatError();
	});

	$presetInput.val($presetSelect.selectpicker('val')); // init with current value
	$presetSelect.on('changed.bs.select, refreshed.bs.select, loaded.bs.select, change', function() {
		$presetInput.val($presetSelect.selectpicker('val'));
	});

	$formatType.on('change', function() {
		const newMode = $(this).selectpicker('val');
		if (newMode === 'json') {
			editor.setOption('mode', {
				name: 'javascript',
				json: true
			});
		} else {
			editor.setOption('mode', newMode);
		}
	});

	$fileInput.on('change', function() {
		if (this.files[0] != null) {
			const file = this.files[0];
			const fr = new FileReader();

			fr.onload = function() {
				editor.setValue(fr.result);
			};
			fr.readAsText(file);
		}
	});

	$downloadButton.on('click', function() {
		const $this = $(this);
		const presetName = $presetInput.val() as string;

		if (!presetName || $this.prop('disabled')) {
			return;
		}

		$this.prop('disabled', true).append('<span class="fa fa-spinner fa-spin"></span>');
		hideFormatError();
		$.ajax(blsUrl + '/input-formats/' + presetName, {
			type: 'GET',
			accepts: {json: 'application/javascript'},
			dataType: 'json',
			success (data) {
				let configFileType = data.configFileType.toLowerCase();
				if (configFileType === 'yml') {
					configFileType = 'yaml';
				}

				$formatType.selectpicker('val', configFileType);
				$formatType.trigger('change');
				editor.setValue(data.configFile);

				// is a user-owned format and no name for the format has been given yet
				// set the format name to this format so the user can easily save over it
				if (!$formatName.val() && presetName.indexOf(':') > 0) {
					$formatName.val(presetName.substr(presetName.indexOf(':')+1));
				}

				$this.closest('.collapse').collapse('hide');
			},
			error (jqXHR, textStatus/*, errorThrown*/) {
				showFormatError(jqXHR.responseJSON && jqXHR.responseJSON.error.message || textStatus);
			},
			complete () {
				$this.prop('disabled', false).find('.fa-spinner').remove();
			}
		});
	});

	$confirmButton.on('click', function() {
		if (!$formatName.val()) {
			showFormatError('Please enter a name.');
			return;
		}

		const fileContents = editor.getValue();
		const fileName = $formatName.val() + '.' + $formatType.selectpicker('val');

		// IE11 does not support File constructor.
		// var file = new File([new Blob([fileContents])], fileName);
		const file = new Blob([fileContents]);
		file.name = fileName;
		file.lastModifiedDate = new Date();
		uploadFormat(file);
	});
}

function initDeleteFormat() {

	$('tbody[data-autoupdate="format"]').on('click', '[data-format-operation="delete"]', function(event) {
		event.preventDefault();

		const formatId = $(this).data('format-id');

		confirmDialog(
			'Delete import format?',
			'You are about to delete the import format <i>' + formatId + '</i>.<br>Are you sure?',
			'Delete',
			function() {
				$.ajax(blsUrl + '/input-formats/' + formatId, {
					type: 'DELETE',
					accepts: {json: 'application/javascript'},
					dataType: 'json',
					success (data) {
						showSuccess(data.status.message);
						refreshFormatList();
					},
					error: showXHRError('Could not delete format'),
				});
			}
		);
	});
}

function initEditFormat() {
	$('tbody[data-autoupdate="format"]').on('click', '[data-format-operation="edit"]', function(event) {
		event.preventDefault();
		const formatId = $(this).data('format-id');

		const $modal = $('#new-format-modal');
		const $presetSelect = $('#format_select');
		const $downloadButton = $('#format_download');
		const $formatName = $('#format_name');
		// formattype determined after download succeeds

		$presetSelect.selectpicker('val', formatId).trigger('change');
		$downloadButton.click();
		$formatName.val(formatId.substr(Math.max(formatId.indexOf(':')+1, 0))); // strip username portion from formatId as username:formatname, if preset

		$modal.modal('show');
	});
}

$(document).ready(function() {
	blsUrl = $('.contentbox').data('blsUrl');

	// Get the list of corpora.
	refreshCorporaList();
	refreshFormatList();

	// Wire up the AJAX uploading functionality.
	initFileUpload();

	// Wire up the "new corpus" and "delete corpus" buttons.
	initNewCorpus();

	initNewFormat();
	initDeleteFormat();
	initEditFormat();
});
