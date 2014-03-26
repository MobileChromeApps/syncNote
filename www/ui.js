function reportError() {
  //alert(errorString);
  console.error(arguments);
}

var UI = function(elem, notesDirectory) {
  this.elem = elem;
  this.listElem = elem.querySelector('ul');
  this.noteElem = elem.querySelector('#note');
  this.notesDirectory = notesDirectory;
  this.bindEventListners();
};

UI.prototype.start = function() {
    this.getNotes((function(notes) {
      this.updateNotes(notes);
    }).bind(this));
};

UI.prototype.updateNotes = function(notes) {
  this.listElem.innerHTML = "";
  notes.forEach((function(elem, index) {
    var line = document.createElement('li');
    line.setAttribute('data-file', elem.file);
    var title = document.createTextNode(elem.title + "(" + elem.file + ")");
    line.appendChild(title);
    var deleteLink = document.createElement('div');
    deleteLink.className = 'delete';
    deleteLink.innerHTML = "Delete";
    line.appendChild(deleteLink);
    //line.addEventListener('click', makeShowNote(elem.file), false);
    deleteLink.addEventListener('click', this.deleteNote.bind(this), false);
    this.listElem.appendChild(line);
    Hammer(line).on('dragright', this.showDelete.bind(deleteLink));
    Hammer(line).on('tap', makeShowNote(elem.file));
  }).bind(this));
  var addLine = document.createElement('li');
  addLine.className = 'add';
  addLine.innerHTML = "Add note";
  this.listElem.appendChild(addLine);
  addLine.addEventListener('click', showNewNote, false);
};

UI.prototype.showDelete = function(ev) {
  this.classList.add('visible');
};

UI.prototype.hideDelete = function(ev) {
  this.classList.remove('visible');
};

function showNewNote(ev) {
  showNoteOverlay(null, "");
}

function nothing(ev) {
  ev.preventDefault();
}

UI.prototype.deleteNote = function(ev) {
  ev.preventDefault();
  ev.stopPropagation();
  var line = ev.target.parentNode;
  deleteNoteByURL(line.getAttribute('data-file'), function() {
    line.parentNode.removeChild(line);
  });
};

function deleteNoteByURL(fileURL, callback) {
  resolveLocalFileSystemURL(fileURL, function(entry) {
    deleteNoteByEntry(entry, callback);
  });
}

function deleteNoteByEntry(entry, callback) {
  entry.remove(callback, function(err) { reportError("remove: " + err); });
}

UI.prototype.getNotesDirectory = function(callback) {
  return callback(this.notesDirectory);
//chrome.syncFileSystem
  requestFileSystem(PERSISTENT, 0, function(fs) {
    fs.root.getDirectory('notes', {create: true}, callback,
    function(err) { reportError("getDirectory: " + err); });
  }, function(err) { reportError("requestFileSystem: " + err); });
};

var files = [];
UI.prototype.getNotes = function(callback) {
  this.getNotesDirectory(function(dirEntry) {
    var reader = dirEntry.createReader();
    reader.readEntries(function(noteEntries) {
      files = [];
      for (var i=0; i < noteEntries.length; ++i) {
        var noteEntry = noteEntries[i];
        files.push({title: "Loading...", file: noteEntry.toURL()});
        readNoteFromEntry(noteEntry, (function(i) { return function(data) {
          files[i].title = firstLine(data);
          callback(files);
        }})(i));
      }
      callback(files);
    }, function(err) { reportError("readEntries: " + err); });
  });
};

function firstLine(contentString) {
  return contentString.split('\n')[0];
}

function readNoteFromEntry(entry, callback) {
  entry.file(function(noteFile) {
    var reader = new FileReader();
    reader.onloadend = function(ev) {
      if (reader.result !== null) {
        callback(reader.result);
      }
    };
    reader.readAsText(noteFile);
  }, function(err) { reportError("file: " + err); });
}

function readNoteFromURL(fileURL, callback) {
  resolveLocalFileSystemURL(fileURL, function(entry) {
    readNoteFromEntry(entry, callback);
  });
}

function showNoteOverlay(url, content) {
  var note = document.getElementById('note');
  note.querySelector('.content').value = content;
  note.style.display = 'block';
  if (url) {
    note.querySelector('button').setAttribute('data-url', url);
  }
}

function makeShowNote(url) {
  return function showNote(ev) {
    ev.stopPropagation();
    var line = ev.target;
    var fileURL = line.getAttribute('data-file');
    readNoteFromURL(fileURL, function(data) { showNoteOverlay(url, data); });
  };
}

UI.prototype.hideNoteOverlay = function() {
  this.noteElem.style.display = 'none';
  this.start();
};

UI.prototype.bindEventListners = function() {
  this.noteElem.querySelector('button').addEventListener('click', (function(ev) {
    ev.stopPropagation();
    var button = this.noteElem.querySelector('button');
    var contents = this.noteElem.querySelector('textarea').value;
    if (button.hasAttribute('data-url')) {
      var fileURL = button.getAttribute('data-url');
      this.noteElem.querySelector('button').removeAttribute('data-url');
      this.saveNoteToURL(fileURL, contents, this.hideNoteOverlay.bind(this));
    } else {
      if (contents.length) {
        this.createNote(contents, this.hideNoteOverlay.bind(this));
      } else {
        this.hideNoteOverlay();
      }
    }
  }).bind(this), false);
};

UI.prototype.saveNoteToEntry = function(entry, contents, callback) {
  entry.createWriter(function(writer) {
    var contentsArray = new ArrayBuffer(contents.length);
    var contentsView = new Uint8Array(contentsArray);
    for (var i = 0; i < contents.length; ++i) {
      contentsView[i] = contents.charCodeAt(i);
    }
    var contentsBlob = new Blob([contents], {type: "text/plain"});
    writer.write(contentsBlob);
    if (typeof callback === 'function') {
      callback();
    }
  }, function(err) { reportError("createWriter: " + err); });
};

UI.prototype.saveNoteToURL = function(fileURL, contents, callback) {
  resolveLocalFileSystemURL(fileURL, (function(entry) {
    this.saveNoteToEntry(entry, contents, callback);
  }).bind(this), function(err) { reportError("resolveLocalFileSystemURL: " + err); });
};

UI.prototype.createNote = function(contents, callback) {
  this.getNotesDirectory((function(dirEntry) {
    var id = "" + (new Date()).getTime() + "." + Math.floor(Math.random()*100000000);
    dirEntry.getFile(id, {create: true, exclusive: true}, (function(entry) {
      this.saveNoteToEntry(entry, contents, callback);
    }).bind(this), function(err) { reportError("getFile: " + err); });
  }).bind(this));
};

window.addEventListener('DOMContentLoaded', function() {
  if (typeof window.resolveLocalFileSystemURL === 'undefined') {
    window.resolveLocalFileSystemURL = window.webkitResolveLocalFileSystemURL;
  }
//  requestFileSystem(PERSISTENT, 0, function(fs) {
//    fs.root.getDirectory('notes', {create: true}, function(dirEntry) {
  chrome.syncFileSystem.requestFileSystem(function(fs) {
    if (!chrome.runtime.lastError) {
      dirEntry = fs.root;
      var appUI = new UI(document.getElementById('app'), dirEntry);
      appUI.start();
      //chrome.syncFileSystem.onFileStatusChanged.addListnener(appUI.start.bind(appUI));
      chrome.syncFileSystem.onFileStatusChanged.addListener(function(detail) {
        console.log("FILES CHANGED");
        console.log(detail);
        appUI.start();
      });
    } else {
      reportError("syncFS.requestFileSystem",chrome.runtime.lastError);
    }
  });
//    }, function(err) { reportError("getDirectory: " + err); });
//  }, function(err) { reportError("requestFileSystem: " + err); });
});
