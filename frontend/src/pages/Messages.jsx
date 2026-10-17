import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import { Avatar, PageHeader } from '../components/ui.jsx';
import { instructorApi } from '../services/instructor.js';
import { useI18n } from '../i18n/index.jsx';
import s from './messages.module.css';

export default function MessagesPage() {
  const { conversationId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, fmtDate, fmtDateTime, lang } = useI18n();

  const queryStudentId = searchParams.get('studentId');
  const queryCohortId = searchParams.get('cohortId');

  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);

  const messagesEndRef = useRef(null);
  const feedContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);

  // Load conversations list
  const fetchConversations = async (silent = false) => {
    try {
      if (!silent) setLoadingConversations(true);
      const res = await instructorApi.conversations();
      const list = Array.isArray(res) ? res : (res?.data || []);
      setConversations(list);
      return list;
    } catch (err) {
      console.error('Failed to load conversations:', err);
      return [];
    } finally {
      if (!silent) setLoadingConversations(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchConversations();
  }, []);

  // Handle direct message initiation via ?studentId=...&cohortId=...
  useEffect(() => {
    if (!queryStudentId) return;

    let active = true;
    const initDirectChat = async () => {
      try {
        setLoadingConversations(true);
        const res = await instructorApi.createConversation({
          studentId: queryStudentId,
          cohortId: queryCohortId || undefined,
        });
        const convo = res?.data || res;
        if (active && convo && convo._id) {
          await fetchConversations(true);
          navigate(`/instructor/messages/${convo._id}`, { replace: true });
        }
      } catch (err) {
        console.error('Failed to initialize conversation with student:', err);
      } finally {
        if (active) setLoadingConversations(false);
      }
    };

    initDirectChat();
    return () => {
      active = false;
    };
  }, [queryStudentId, queryCohortId]);

  // Load active conversation & messages when conversationId changes
  useEffect(() => {
    if (!conversationId) {
      setActiveConversation(null);
      setMessages([]);
      return;
    }

    let active = true;

    const loadChat = async () => {
      setLoadingMessages(true);
      setSendError(null);
      try {
        // Fetch conversation details and messages
        const [convoRes, msgsRes] = await Promise.all([
          instructorApi.conversation(conversationId),
          instructorApi.messages(conversationId, { limit: 100 }),
        ]);

        if (!active) return;

        const convo = convoRes?.data || convoRes;
        setActiveConversation(convo);

        const msgList = Array.isArray(msgsRes) ? msgsRes : (msgsRes?.data || []);
        setMessages(msgList);
        shouldAutoScrollRef.current = true;

        // Mark as read
        if (convo?.unreadCountInstructor > 0) {
          instructorApi.markMessagesRead(conversationId).catch(() => {});
          setConversations((prev) =>
            prev.map((c) =>
              c._id === conversationId ? { ...c, unreadCountInstructor: 0 } : c
            )
          );
        }
      } catch (err) {
        if (active) {
          console.error('Failed to load active conversation:', err);
          setActiveConversation(null);
        }
      } finally {
        if (active) setLoadingMessages(false);
      }
    };

    loadChat();

    return () => {
      active = false;
    };
  }, [conversationId]);

  // Real-time polling for messages & conversation updates
  useEffect(() => {
    if (!conversationId) return;

    const pollInterval = setInterval(async () => {
      try {
        const msgsRes = await instructorApi.messages(conversationId, { limit: 100 });
        const newMsgs = Array.isArray(msgsRes) ? msgsRes : (msgsRes?.data || []);

        setMessages((prev) => {
          // If count or last message ID changed
          if (newMsgs.length !== prev.length || (newMsgs.length && prev.length && newMsgs[newMsgs.length - 1]?._id !== prev[prev.length - 1]?._id)) {
            // Check if user was scrolled near bottom to autoscroll
            if (feedContainerRef.current) {
              const { scrollTop, scrollHeight, clientHeight } = feedContainerRef.current;
              shouldAutoScrollRef.current = scrollHeight - scrollTop - clientHeight < 120;
            }
            return newMsgs;
          }
          return prev;
        });

        // Mark read quietly during active view
        instructorApi.markMessagesRead(conversationId).catch(() => {});

        // Quietly refresh conversation list metadata
        fetchConversations(true);
      } catch (err) {
        // Silent failure on polling
      }
    }, 4000);

    return () => clearInterval(pollInterval);
  }, [conversationId]);

  // Autoscroll logic
  useEffect(() => {
    if (shouldAutoScrollRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Send message
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const content = draft.trim();
    if (!content || sending || !conversationId) return;

    setSending(true);
    setSendError(null);

    try {
      const res = await instructorApi.sendMessage(conversationId, { body: content });
      const createdMessage = res?.data || res;

      if (createdMessage && createdMessage._id) {
        setMessages((prev) => [...prev, createdMessage]);
      }
      setDraft('');
      shouldAutoScrollRef.current = true;

      // Update conversation in list
      setConversations((prev) =>
        prev.map((c) =>
          c._id === conversationId
            ? {
                ...c,
                lastMessage: {
                  body: content,
                  senderRole: 'instructor',
                  createdAt: new Date().toISOString(),
                },
                lastMessageAt: new Date().toISOString(),
              }
            : c
        )
      );

      // Focus back on textarea
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setSendError(err.message || t('messages.failedToSend'));
    } finally {
      setSending(false);
    }
  };

  // Keyboard shortcut: Enter sends, Shift+Enter new line
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = c.student?.name?.toLowerCase() || '';
    const cohort = c.cohort?.name?.toLowerCase() || '';
    const course = c.course?.code?.toLowerCase() || '';
    return name.includes(q) || cohort.includes(q) || course.includes(q);
  });

  // Group messages by date
  const groupMessagesByDate = (msgs) => {
    const groups = [];
    let currentDate = null;

    (msgs || []).forEach((msg) => {
      if (!msg || !msg.createdAt) return;
      const msgDate = new Date(msg.createdAt).toLocaleDateString();
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ type: 'date', date: msg.createdAt });
      }
      groups.push({ type: 'msg', data: msg });
    });

    return groups;
  };

  const hasActiveChat = Boolean(conversationId && activeConversation);

  return (
    <>
      <PageHeader
        eyebrow={t('navGroup.learners')}
        title={t('messages.title')}
        subtitle={t('messages.subtitle')}
      />

      <div className={s.messagingContainer} data-active-chat={hasActiveChat}>
        {/* Sidebar: Conversation List */}
        <aside className={s.sidebar} aria-label="Cadet Conversations">
          <div className={s.sidebarHeader}>
            <div className="d-flex align-items-center justify-content-between">
              <span className="fw-bold small text-uppercase text-muted" style={{ letterSpacing: '0.04em' }}>
                {t('messages.title')}
              </span>
              <span className="badge bg-light text-dark border mono small">
                {conversations.length}
              </span>
            </div>
            <div className={s.searchWrap}>
              <i className={`fa-solid fa-magnifying-glass ${s.searchIcon}`} />
              <input
                type="search"
                className={s.searchInput}
                placeholder={t('messages.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={t('common.search')}
              />
            </div>
          </div>

          <div className={s.conversationList} role="list">
            {loadingConversations ? (
              <div className="p-4 text-center text-muted">
                <Spinner animation="border" size="sm" variant="primary" />
                <div className="small mt-2">{t('common.loading')}</div>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-4 text-center text-muted">
                <i className="fa-solid fa-comments text-muted mb-2" style={{ fontSize: '1.8rem', opacity: 0.4 }} />
                <div className="small fw-semibold">{t('messages.empty')}</div>
                <div className="small text-muted mt-1" style={{ fontSize: '0.78rem' }}>
                  {t('messages.emptySub')}
                </div>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const isActive = c._id === conversationId;
                const unread = c.unreadCountInstructor || 0;
                const snippet = typeof c.lastMessage === 'string'
                  ? c.lastMessage
                  : (c.lastMessage?.body || '');

                return (
                  <div
                    key={c._id}
                    role="button"
                    tabIndex={0}
                    className={`${s.conversationItem} ${isActive ? s.active : ''}`}
                    onClick={() => navigate(`/instructor/messages/${c._id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/instructor/messages/${c._id}`);
                      }
                    }}
                  >
                    <Avatar user={c.student} size={42} showOnline />
                    <div className={s.convoDetails}>
                      <div className={s.convoTop}>
                        <span className={s.studentName}>{c.student?.name || t('common.student')}</span>
                        {c.lastMessageAt && (
                          <span className={s.convoTime}>
                            {fmtDate(c.lastMessageAt)}
                          </span>
                        )}
                      </div>
                      <div className={s.convoBottom}>
                        <span className={s.lastSnippet}>
                          {snippet || <span className="fst-italic">{t('messages.noMessagesYet')}</span>}
                        </span>
                        {unread > 0 && (
                          <span className={s.unreadCount} aria-label={`${unread} ${t('messages.unreadCount')}`}>
                            {unread}
                          </span>
                        )}
                      </div>
                      {c.cohort?.name && (
                        <span className={s.cohortTag}>
                          {c.cohort.name} {c.course?.code ? `· ${c.course.code}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Main Conversation Panel */}
        <section className={s.chatArea} aria-label="Active Message Thread">
          {hasActiveChat ? (
            <>
              {/* Header */}
              <div className={s.chatHeader}>
                <div className={s.headerInfo}>
                  <button
                    type="button"
                    className={s.backBtn}
                    onClick={() => navigate('/instructor/messages')}
                    title={t('messages.backToList')}
                    aria-label={t('messages.backToList')}
                  >
                    <i className={`fa-solid ${lang === 'ar' ? 'fa-arrow-right' : 'fa-arrow-left'}`} />
                  </button>
                  <Avatar user={activeConversation.student} size={42} showOnline />
                  <div className={s.headerMeta}>
                    <div className={s.headerName}>
                      <span>{activeConversation.student?.name}</span>
                      <span className={s.cadetBadge}>{t('messages.cadet')}</span>
                    </div>
                    <div className={s.headerSubtitle}>
                      <span className={s.onlinePulse} />
                      <span>{activeConversation.student?.email}</span>
                      {activeConversation.cohort?.name && (
                        <span>· {activeConversation.cohort.name}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <span className={s.pollingDot} title={t('messages.refreshing')} />
                </div>
              </div>

              {/* Message Feed */}
              <div
                className={s.messageFeed}
                ref={feedContainerRef}
                role="log"
                aria-live="polite"
              >
                {loadingMessages ? (
                  <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted">
                    <Spinner animation="border" size="sm" variant="primary" />
                    <span className="small mt-2">{t('common.loading')}</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className={s.emptyFeed}>
                    <i className={`fa-regular fa-comment-dots ${s.emptyFeedIcon}`} />
                    <h5 className="fw-semibold text-dark mb-1">{t('messages.noMessagesYet')}</h5>
                    <p className="small text-muted mb-0">{t('messages.subtitle')}</p>
                  </div>
                ) : (
                  groupMessagesByDate(messages).map((item, idx) => {
                    if (item.type === 'date') {
                      return (
                        <div key={`date-${idx}`} className={s.dateSeparator}>
                          <span>{fmtDate(item.date)}</span>
                        </div>
                      );
                    }

                    const m = item.data;
                    if (!m) return null;
                    const isInstructor = m.senderRole === 'instructor';

                    return (
                      <div
                        key={m._id || `msg-${idx}`}
                        className={`${s.messageRow} ${isInstructor ? s.instructor : s.student}`}
                      >
                        {!isInstructor && (
                          <div className={s.messageAvatar}>
                            <Avatar user={activeConversation.student} size={28} />
                          </div>
                        )}
                        <div className={s.bubble}>
                          <div>{m.body}</div>
                          <div className={s.bubbleMeta}>
                            <span>
                              {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              }) : ''}
                            </span>
                            {isInstructor && (
                              <i
                                className={`fa-solid fa-check-double ${s.readTick}`}
                                title={m.read ? 'Read' : 'Sent'}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Composer */}
              <div className={s.composer}>
                {sendError && (
                  <div className={s.errorBanner}>
                    <span>{sendError}</span>
                    <button
                      type="button"
                      className="btn btn-sm btn-link text-danger p-0 fw-bold"
                      onClick={handleSendMessage}
                    >
                      {t('messages.retry')}
                    </button>
                  </div>
                )}
                <form className={s.composerForm} onSubmit={handleSendMessage}>
                  <div className={s.textareaWrap}>
                    <textarea
                      ref={textareaRef}
                      className={s.composerTextarea}
                      placeholder={t('messages.typePlaceholder')}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={handleKeyDown}
                      rows={2}
                      disabled={sending}
                      aria-label={t('messages.typePlaceholder')}
                    />
                    <div className={s.composerHint}>
                      <span>{t('messages.typePlaceholder')}</span>
                      <span className="mono">{draft.length}/2000</span>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className={s.sendBtn}
                    disabled={!draft.trim() || sending}
                    title={t('messages.send')}
                    aria-label={t('messages.send')}
                  >
                    {sending ? (
                      <Spinner animation="border" size="sm" />
                    ) : (
                      <i className="fa-solid fa-paper-plane" />
                    )}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className={s.noSelection}>
              <i className={`fa-solid fa-comment-nodes ${s.noSelectionIcon}`} />
              <h5 className="fw-bold text-dark mb-2">{t('messages.conversationWith')} EGSA Cadets</h5>
              <p className="small text-muted mb-0" style={{ maxWidth: 360 }}>
                {t('messages.selectToRead')}
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
