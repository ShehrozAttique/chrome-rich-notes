document.addEventListener("DOMContentLoaded", () => {
  const mainContainer = document.getElementById("main-container"); // Added reference
  const titleInput = document.getElementById("note-title");
  const editor = document.getElementById("editor");
  const saveBtn = document.getElementById("save-btn");
  const notesGrid = document.getElementById("notes-grid");

  const modal = document.getElementById("note-modal");
  const modalTitle = document.getElementById("modal-title");
  const modalBody = document.getElementById("modal-body");
  const modalClose = document.getElementById("modal-close");

  const highlighter = (classNameList, needsRemoval) => {
    classNameList.forEach((button) => {
      button.addEventListener("click", () => {
        if (needsRemoval) {
          let alreadyActive = button.classList.contains("active");
          classNameList.forEach((btn) => btn.classList.remove("active"));
          if (!alreadyActive) button.classList.add("active");
        } else {
          button.classList.toggle("active");
        }
      });
    });
  };

  function initializeToolbar(toolbarSelector, targetEditor, isModal = false) {
    const toolbar = document.querySelector(toolbarSelector);
    if (!toolbar) return;

    const optionsButtons = toolbar.querySelectorAll(
      ".option-button:not(.link-btn)",
    );
    const linkButton = toolbar.querySelector(".link-btn");

    const alignButtons = toolbar.querySelectorAll(".align");
    const spacingButtons = toolbar.querySelectorAll(".spacing");
    const formatButtons = toolbar.querySelectorAll(".format");
    const scriptButtons = toolbar.querySelectorAll(".script");

    highlighter(alignButtons, true);
    highlighter(spacingButtons, true);
    highlighter(formatButtons, false);
    highlighter(scriptButtons, true);

    optionsButtons.forEach((button) => {
      button.addEventListener("mousedown", (e) => e.preventDefault());
      button.addEventListener("click", () => {
        const command = button.dataset.command;
        document.execCommand(command, false, null);
        targetEditor.focus();
        if (isModal) handleModalEdit();
      });
    });

    if (linkButton) {
      linkButton.addEventListener("mousedown", (e) => e.preventDefault());
      linkButton.addEventListener("click", () => {
        let userLink = prompt("Enter a URL");
        if (userLink) {
          if (!/http/i.test(userLink)) userLink = "http://" + userLink;
          document.execCommand("createLink", false, userLink);
          targetEditor.focus();
          if (isModal) handleModalEdit();
        }
      });
    }
  }

  initializeToolbar(".toolbar-main", editor, false);
  initializeToolbar(".toolbar-modal", modalBody, true);

  let notes = JSON.parse(localStorage.getItem("keepNotes")) || [];

  // --- NEW EXPAND/COLLAPSE & SAVE ENGINE ---

  // 1. Expand the home page input when clicked
  mainContainer.addEventListener("click", () => {
    if (mainContainer.classList.contains("collapsed")) {
      mainContainer.classList.remove("collapsed");
      editor.focus();
    }
  });

  // 2. Collapse and Save when clicking OUTSIDE the home page input
  document.addEventListener("click", (e) => {
    if (
      !mainContainer.contains(e.target) &&
      !mainContainer.classList.contains("collapsed")
    ) {
      closeAndSaveMainEditor();
    }
  });

  // 3. Manual Save Button
  saveBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // Stop the document click listener from firing
    closeAndSaveMainEditor();
  });

  function closeAndSaveMainEditor() {
    const title = titleInput.value.trim();
    const content = editor.innerHTML.trim();

    if ((content && content !== "<br>") || title) {
      const newNote = {
        id: Date.now().toString(),
        title: title,
        content: content,
      };
      notes.unshift(newNote);
      saveNotes();
      renderNotes();
    }

    titleInput.value = "";
    editor.innerHTML = "";
    mainContainer.classList.add("collapsed");
  }

  // --- REST OF THE CODE REMAINS UNCHANGED ---

  function deleteNote(id) {
    notes = notes.filter((note) => note.id !== id);
    saveNotes();
    renderNotes();
  }

  function saveNotes() {
    localStorage.setItem("keepNotes", JSON.stringify(notes));
  }

  function renderNotes() {
    notesGrid.innerHTML = "";
    notes.forEach((note, index) => {
      const noteEl = document.createElement("div");
      noteEl.className = "note";
      noteEl.draggable = true;
      noteEl.dataset.index = index;

      const titleHTML = note.title
        ? `<div class="note-title-display">${note.title}</div>`
        : "";

      noteEl.innerHTML = `
        <button class="delete-btn" data-id="${note.id}">✕</button>
        ${titleHTML}
        <div class="note-content">${note.content}</div>
      `;

      const deleteBtn = noteEl.querySelector(".delete-btn");
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteNote(note.id);
      });

      noteEl.addEventListener("click", () => openModal(note));
      noteEl.addEventListener("dragstart", handleDragStart);
      noteEl.addEventListener("dragover", handleDragOver);
      noteEl.addEventListener("drop", handleDrop);
      noteEl.addEventListener("dragend", handleDragEnd);

      notesGrid.appendChild(noteEl);
    });
  }

  let activeNoteId = null;

  function openModal(note) {
    activeNoteId = note.id;
    modalTitle.value = note.title || "";
    modalBody.innerHTML = note.content || "";
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    activeNoteId = null;
    modal.classList.add("hidden");
    document.body.style.overflow = "";
    document
      .querySelectorAll(".toolbar-modal .active")
      .forEach((el) => el.classList.remove("active"));
  }

  function handleModalEdit() {
    if (!activeNoteId) return;
    const updatedTitle = modalTitle.value.trim();
    const updatedContent = modalBody.innerHTML.trim();
    const noteIndex = notes.findIndex((n) => n.id === activeNoteId);

    if (noteIndex > -1) {
      notes[noteIndex].title = updatedTitle;
      notes[noteIndex].content = updatedContent;
      saveNotes();
      renderNotes();
    }
  }

  modalTitle.addEventListener("input", handleModalEdit);
  modalBody.addEventListener("input", handleModalEdit);

  modalClose.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
  });

  let dragStartIndex;

  function handleDragStart(e) {
    dragStartIndex = +this.dataset.index;
    this.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e) {
    e.preventDefault();
    const dragEndIndex = +this.dataset.index;
    swapNotes(dragStartIndex, dragEndIndex);
    this.classList.remove("dragging");
  }

  function handleDragEnd() {
    this.classList.remove("dragging");
    renderNotes();
  }

  function swapNotes(fromIndex, toIndex) {
    const itemToMove = notes.splice(fromIndex, 1)[0];
    notes.splice(toIndex, 0, itemToMove);
    saveNotes();
    renderNotes();
  }

  renderNotes();
});
