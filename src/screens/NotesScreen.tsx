import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type NoteLog } from '../db/database';
import FastingTimer from '../components/FastingTimer';
import CalorieTargetCard from '../components/CalorieTargetCard';
import { 
  BookOpen, 
  Flame, 
  Plus, 
  Search, 
  Trash2, 
  Calendar, 
  Tag, 
  ArrowLeft, 
  Edit3, 
  Eye, 
  Check, 
  BookMarked 
} from 'lucide-react';

export default function NotesScreen() {
  const [activeTab, setActiveTab] = useState<'journals' | 'fasting'>('journals');
  
  // Note-taking state
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [editorNotebook, setEditorNotebook] = useState('Personal');
  const [tagInput, setTagInput] = useState('');
  const [editMode, setEditMode] = useState<'edit' | 'preview'>('edit');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');

  // Mobile View Management
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');

  const autosaveTimer = useRef<any>(null);

  // Fetch notes from Dexie (ordered by newest updated first)
  const notes = useLiveQuery(async () => {
    return await db.notes.reverse().sortBy('updatedAt') || [];
  });

  // Extract all distinct tags from notes
  const allTags = useMemoAllTags(notes || []);

  const activeNote = notes?.find(n => n.id === selectedNoteId);

  // Sync editor inputs when the active note changes
  useEffect(() => {
    if (activeNote) {
      setEditorTitle(activeNote.title);
      setEditorContent(activeNote.content);
      setEditorNotebook(activeNote.notebook || 'Personal');
    } else {
      setEditorTitle('');
      setEditorContent('');
      setEditorNotebook('Personal');
    }
    setSaveStatus('saved');
  }, [selectedNoteId]);

  // Debounced Autosave (500ms delay)
  useEffect(() => {
    if (!selectedNoteId) return;

    // Detect if content actually changed to avoid unnecessary writes
    if (activeNote && 
        activeNote.title === editorTitle && 
        activeNote.content === editorContent && 
        activeNote.notebook === editorNotebook) {
      return;
    }

    setSaveStatus('saving');

    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
    }

    autosaveTimer.current = setTimeout(async () => {
      try {
        await db.notes.update(selectedNoteId, {
          title: editorTitle || 'Untitled Note',
          content: editorContent,
          notebook: editorNotebook,
          updatedAt: new Date().toISOString()
        });
        setSaveStatus('saved');
      } catch (err) {
        console.error('Autosave failed:', err);
        setSaveStatus('error');
      }
    }, 500);

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [editorTitle, editorContent, editorNotebook, selectedNoteId]);

  // Helper hook to gather tags
  function useMemoAllTags(noteLogs: NoteLog[]) {
    const tagsSet = new Set<string>();
    noteLogs.forEach(note => {
      if (note.tags) {
        note.tags.forEach(t => tagsSet.add(t));
      }
    });
    return Array.from(tagsSet);
  }

  const handleCreateNote = async () => {
    const nowISO = new Date().toISOString();
    try {
      const id = await db.notes.add({
        title: 'Untitled Note',
        content: '',
        tags: [],
        notebook: 'Personal',
        createdAt: nowISO,
        updatedAt: nowISO
      });
      setSelectedNoteId(id);
      setEditMode('edit');
      setMobileView('editor');
    } catch (err) {
      console.error('Failed to create note:', err);
    }
  };

  const handleDeleteNote = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to delete this journal entry?')) return;

    try {
      await db.notes.delete(id);
      if (selectedNoteId === id) {
        setSelectedNoteId(null);
        setMobileView('list');
      }
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNoteId || !activeNote) return;

    const cleanTag = tagInput.trim().toLowerCase();
    if (cleanTag && !activeNote.tags.includes(cleanTag)) {
      const updatedTags = [...activeNote.tags, cleanTag];
      try {
        await db.notes.update(selectedNoteId, {
          tags: updatedTags,
          updatedAt: new Date().toISOString()
        });
        setTagInput('');
      } catch (err) {
        console.error('Failed to add tag:', err);
      }
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!selectedNoteId || !activeNote) return;

    const updatedTags = activeNote.tags.filter(t => t !== tagToRemove);
    try {
      await db.notes.update(selectedNoteId, {
        tags: updatedTags,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Failed to remove tag:', err);
    }
  };

  const toggleFilterTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const filteredNotes = (notes || []).filter(note => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      note.title.toLowerCase().includes(query) || 
      note.content.toLowerCase().includes(query) ||
      (note.notebook && note.notebook.toLowerCase().includes(query));

    const matchesTags = 
      selectedTags.length === 0 || 
      selectedTags.every(tag => note.tags && note.tags.includes(tag));

    return matchesSearch && matchesTags;
  });

  // Client-Side Markdown Formatter
  const renderMarkdown = (text: string) => {
    if (!text) {
      return `<p style="color: var(--text-muted); font-style: italic;">No text logged yet. Switch to Edit mode and start writing...</p>`;
    }

    // Escape basic HTML
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Header replacements
    html = html
      .replace(/^# (.*?)$/gm, '<h1 class="md-h1" style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary); margin-top: 18px; margin-bottom: 10px; font-family: var(--font-display); border-bottom: 1px solid var(--border-subtle); padding-bottom: 6px;">$1</h1>')
      .replace(/^## (.*?)$/gm, '<h2 class="md-h2" style="font-size: 1.25rem; font-weight: 600; color: var(--text-primary); margin-top: 14px; margin-bottom: 8px; font-family: var(--font-display);">$1</h2>')
      .replace(/^### (.*?)$/gm, '<h3 class="md-h3" style="font-size: 1.1rem; font-weight: 600; color: var(--text-secondary); margin-top: 12px; margin-bottom: 6px; font-family: var(--font-display);">$1</h3>');

    // Bullet lists
    html = html
      .replace(/^\* (.*?)$/gm, '<li class="md-li" style="margin-left: 20px; list-style-type: disc; margin-bottom: 4px; color: var(--text-primary);">$1</li>')
      .replace(/^- (.*?)$/gm, '<li class="md-li" style="margin-left: 20px; list-style-type: disc; margin-bottom: 4px; color: var(--text-primary);">$1</li>');

    // Bold tags
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="md-strong" style="font-weight: 700; color: var(--accent);">$1</strong>');

    // Horizontal Rule
    html = html.replace(/---/g, '<hr class="md-hr" style="border: none; border-top: 1px solid var(--border-subtle); margin: 16px 0;" />');

    // Paragraph returns
    html = html.replace(/\n/g, '<br />');

    return html;
  };

  return (
    <div className="notes-screen">
      {/* Screen Title */}
      <div className="section-header" style={{ marginBottom: 'var(--space-md)' }}>
        <h2 className="text-h1" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {activeTab === 'journals' ? <BookOpen size={24} color="var(--accent)" /> : <Flame size={24} color="var(--accent3)" />}
          Health Journals & Timer
        </h2>
      </div>

      {/* Screen Sub-Tabs Navigation */}
      <div style={{ display: 'flex', gap: 'var(--space-sm)', background: 'var(--bg-glass-strong)', padding: '6px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', marginBottom: 'var(--space-md)' }}>
        <button 
          onClick={() => setActiveTab('journals')}
          className="btn"
          style={{ 
            flex: 1, 
            padding: '10px 16px', 
            borderRadius: 'var(--radius-md)', 
            fontSize: '0.875rem',
            background: activeTab === 'journals' ? 'var(--bg-card)' : 'transparent',
            border: activeTab === 'journals' ? '1px solid var(--border-subtle)' : 'none',
            color: activeTab === 'journals' ? 'var(--text-primary)' : 'var(--text-secondary)'
          }}
        >
          📓 Journals & Logs
        </button>
        <button 
          onClick={() => setActiveTab('fasting')}
          className="btn"
          style={{ 
            flex: 1, 
            padding: '10px 16px', 
            borderRadius: 'var(--radius-md)', 
            fontSize: '0.875rem',
            background: activeTab === 'fasting' ? 'var(--bg-card)' : 'transparent',
            border: activeTab === 'fasting' ? '1px solid var(--border-subtle)' : 'none',
            color: activeTab === 'fasting' ? 'var(--text-primary)' : 'var(--text-secondary)'
          }}
        >
          ⏱️ Fasting & Nutrition
        </button>
      </div>

      {/* Active Tab: Fasting & Nutrition */}
      {activeTab === 'fasting' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <FastingTimer />
          <CalorieTargetCard onNoteCreated={() => {
            // Callback to refresh or notify
            setSaveStatus('saved');
          }} />
        </div>
      )}

      {/* Active Tab: Journals & Logs */}
      {activeTab === 'journals' && (
        <div className="journals-workspace-split">
          
          {/* Notes Sidebar (List & Search) */}
          <div className={`notes-sidebar ${mobileView === 'editor' ? 'mobile-hidden' : ''}`}>
            
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  placeholder="Search journals or notebooks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '36px', height: '40px', fontSize: '0.875rem' }}
                />
              </div>
              <button 
                onClick={handleCreateNote} 
                className="btn btn-primary" 
                style={{ width: '40px', height: '40px', padding: 0, borderRadius: 'var(--radius-md)' }}
                aria-label="Add new note"
              >
                <Plus size={20} />
              </button>
            </div>

            {/* Tags Horizontal Scroll Filter */}
            {allTags.length > 0 && (
              <div className="tags-scroll-row" style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '10px', marginBottom: 'var(--space-md)', scrollbarWidth: 'none' }}>
                {allTags.map(tag => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button 
                      key={tag} 
                      onClick={() => toggleFilterTag(tag)}
                      style={{ 
                        flexShrink: 0,
                        fontSize: '0.75rem',
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-full)',
                        background: isSelected ? 'var(--accent-dim)' : 'var(--bg-glass-strong)',
                        border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                        color: isSelected ? 'var(--accent)' : 'var(--text-secondary)'
                      }}
                    >
                      #{tag}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Note Previews List */}
            <div className="notes-scroller" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '500px', overflowY: 'auto' }}>
              {filteredNotes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 'var(--space-xl)', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No journal logs found.</p>
                </div>
              ) : (
                filteredNotes.map(note => (
                  <div 
                    key={note.id}
                    onClick={() => {
                      if (note.id) {
                        setSelectedNoteId(note.id);
                        setMobileView('editor');
                      }
                    }}
                    className={`glass-card ${selectedNoteId === note.id ? 'glass-card--accent' : ''}`}
                    style={{ 
                      padding: '12px var(--space-md)', 
                      cursor: 'pointer',
                      background: selectedNoteId === note.id ? 'linear-gradient(135deg, rgba(0, 230, 138, 0.04) 0%, var(--bg-card) 100%)' : 'var(--bg-card)',
                      border: selectedNoteId === note.id ? '1px solid var(--accent)' : '1px solid var(--border-subtle)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--accent2)', fontWeight: 600, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <BookMarked size={10} />
                        {note.notebook || 'Personal'}
                      </span>
                      <button 
                        onClick={(e) => {
                          if (note.id) handleDeleteNote(note.id, e);
                        }}
                        style={{ color: 'var(--text-muted)', padding: '2px' }}
                        aria-label="Delete note"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, margin: '4px 0 6px 0', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {note.title || 'Untitled Note'}
                    </h4>

                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', margin: '0 0 8px 0', lineHeight: 1.3 }}>
                      {note.content ? note.content.replace(/[#*_-]/g, '') : 'Empty note.'}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={10} />
                        {new Date(note.updatedAt).toLocaleDateString()}
                      </span>
                      {note.tags && note.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', maxWidth: '60%', overflow: 'hidden' }}>
                          {note.tags.slice(0, 2).map(tag => (
                            <span key={tag} style={{ fontSize: '0.625rem', color: 'var(--text-secondary)', background: 'var(--bg-glass-strong)', padding: '2px 6px', borderRadius: '4px' }}>
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Note Editor View (Active workspace) */}
          <div className={`note-editor-panel ${mobileView === 'list' ? 'mobile-hidden' : ''}`}>
            {activeNote ? (
              <div className="glass-card" style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', height: '100%', minHeight: '420px', border: '1px solid var(--border-subtle)' }}>
                
                {/* Editor Header Navigation Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                  <button 
                    onClick={() => setMobileView('list')}
                    className="mobile-only-btn"
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.875rem', color: 'var(--accent)' }}
                  >
                    <ArrowLeft size={16} />
                    <span>Back</span>
                  </button>

                  <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-glass-strong)', padding: '3px', borderRadius: 'var(--radius-md)' }}>
                    <button 
                      onClick={() => setEditMode('edit')}
                      style={{ 
                        display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '6px 10px', borderRadius: '4px',
                        background: editMode === 'edit' ? 'var(--bg-secondary)' : 'transparent',
                        color: editMode === 'edit' ? 'var(--text-primary)' : 'var(--text-secondary)'
                      }}
                    >
                      <Edit3 size={12} />
                      <span>Edit</span>
                    </button>
                    <button 
                      onClick={() => setEditMode('preview')}
                      style={{ 
                        display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '6px 10px', borderRadius: '4px',
                        background: editMode === 'preview' ? 'var(--bg-secondary)' : 'transparent',
                        color: editMode === 'preview' ? 'var(--text-primary)' : 'var(--text-secondary)'
                      }}
                    >
                      <Eye size={12} />
                      <span>Preview</span>
                    </button>
                  </div>

                  {/* Autosave Status Pill */}
                  <span style={{ fontSize: '0.75rem', color: saveStatus === 'saving' ? 'var(--accent3)' : saveStatus === 'error' ? 'var(--danger)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'error' ? 'Error' : (
                      <>
                        <Check size={12} color="var(--accent)" />
                        <span>Saved</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Editor Body Inputs */}
                {editMode === 'edit' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', flex: 1 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.6875rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>Notebook</label>
                        <select 
                          value={editorNotebook} 
                          onChange={(e) => setEditorNotebook(e.target.value)}
                          style={{ height: '36px', padding: '6px 12px', fontSize: '0.8125rem' }}
                        >
                          <option value="Personal">📓 Personal</option>
                          <option value="Health Logs">🥗 Health Logs</option>
                          <option value="Workouts">💪 Workouts</option>
                          <option value="Goals">🎯 Goals</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.6875rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>Note Title</label>
                        <input 
                          type="text" 
                          placeholder="Untitled Note"
                          value={editorTitle}
                          onChange={(e) => setEditorTitle(e.target.value)}
                          style={{ height: '36px', padding: '6px 12px', fontSize: '0.8125rem' }}
                        />
                      </div>
                    </div>

                    {/* Tag Editor Form */}
                    <div style={{ borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', padding: '10px 0' }}>
                      <form onSubmit={handleAddTag} style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                        <input 
                          type="text" 
                          placeholder="Add hashtag..." 
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          style={{ height: '32px', padding: '6px 12px', fontSize: '0.75rem', flex: 1 }}
                        />
                        <button type="submit" className="btn btn-secondary btn-sm" style={{ height: '32px', padding: '0 12px' }}>
                          <Tag size={12} />
                        </button>
                      </form>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {activeNote.tags?.map(t => (
                          <span 
                            key={t} 
                            style={{ 
                              fontSize: '0.6875rem', 
                              padding: '2px 8px', 
                              borderRadius: '4px', 
                              background: 'var(--bg-glass-strong)', 
                              border: '1px solid var(--border-subtle)', 
                              color: 'var(--text-secondary)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            #{t}
                            <button 
                              type="button" 
                              onClick={() => handleRemoveTag(t)}
                              style={{ color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 800, padding: 0 }}
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    <textarea 
                      placeholder="Type here to capture your notes (supports markdown formatting # h1, ## h2, **bold**, - lists, --- lines)..."
                      value={editorContent}
                      onChange={(e) => setEditorContent(e.target.value)}
                      style={{ flex: 1, minHeight: '260px', resize: 'vertical', fontSize: '0.9375rem', lineHeight: 1.5, background: 'transparent', border: 'none', padding: 0 }}
                    />
                  </div>
                ) : (
                  // Markdown Preview Output
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    <div style={{ marginBottom: 'var(--space-md)' }}>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--accent2)', background: 'var(--accent2-dim)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, textTransform: 'uppercase' }}>
                        {activeNote.notebook || 'Personal'}
                      </span>
                      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '8px 0 6px 0', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                        {activeNote.title || 'Untitled Note'}
                      </h2>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {activeNote.tags?.map(t => (
                          <span key={t} style={{ fontSize: '0.6875rem', color: 'var(--accent)', background: 'var(--accent-dim)', padding: '2px 8px', borderRadius: '4px' }}>
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div 
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(editorContent) }} 
                      style={{ fontSize: '0.9375rem', lineHeight: 1.6, color: 'var(--text-primary)' }}
                    />
                  </div>
                )}

              </div>
            ) : (
              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '420px', textAlign: 'center', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}>
                <Edit3 size={40} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
                <h4 style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px' }}>No Entry Selected</h4>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0, maxWidth: '240px' }}>
                  Choose a health log or journal from the list to begin editing, or create a new note.
                </p>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
