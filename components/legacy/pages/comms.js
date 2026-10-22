/* Mobsie Connect — Communications: Messages, Newsletters, Push, SMS, Campaigns, Feedback */
window.Pages=window.Pages||{};
(function(){
  const esc=UI.esc, F=DB.fmtN;

  /* ---------- Messages (chat) ---------- */
  /* ---------- Messages (chat) ---------- */

const mState = {
  active: 0,
  loaded: false,
  loading: false,
  conversations: [],
};


/**
 * Escape / formatting helpers
 */
function messageTime(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const now = new Date();

  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString([], {
    day: "2-digit",
    month: "short",
  });
}


function fullMessageTime(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}


/**
 * Normal GET request.
 *
 * We use fetch here so this implementation does not depend
 * on MobsieApi having a .get() function.
 */
async function fetchMessages() {
  const response = await fetch(
    "/api/mobile-admin/messages?limit=500",
    {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    },
  );

  let json;

  try {
    json = await response.json();
  } catch {
    throw new Error("The messages server returned an invalid response.");
  }

  if (!response.ok || json?.ok === false) {
    throw new Error(
      json?.error?.message ||
      "Could not load messages.",
    );
  }

  return Array.isArray(json?.data)
    ? json.data
    : [];
}


/**
 * Convert database rows into the structure
 * required by the existing chat UI.
 */
function buildConversations(messages) {
  const groups = new Map();

  for (const message of messages) {
    if (!message?.parentAccountId) {
      continue;
    }

    let conversation = groups.get(
      message.parentAccountId,
    );

    if (!conversation) {
      conversation = {
        id: message.parentAccountId,

        parentAccountId:
          message.parentAccountId,

        who:
          message.parentName ||
          message.parentEmail ||
          "Parent",

        email:
          message.parentEmail || "",

        school:
          DB.SCHOOL_NAME || "School",

        branch: "",

        unread: 0,

        time: "",

        preview: "",

        latestCreatedAt: "",

        msgs: [],
      };

      groups.set(
        message.parentAccountId,
        conversation,
      );
    }

    const isSchool =
      String(message.senderType).toUpperCase() ===
      "SCHOOL";

    conversation.msgs.push({
      id: message.id,

      dir: isSchool
        ? "out"
        : "in",

      text:
        message.body || "",

      time:
        fullMessageTime(
          message.createdAt,
        ),

      createdAt:
        message.createdAt,

      senderType:
        message.senderType,

      senderName:
        message.senderName,

      readAt:
        message.readAt,
    });

    /**
     * Count unread messages sent from parent.
     */
    if (
      !isSchool &&
      !message.readAt
    ) {
      conversation.unread += 1;
    }
  }


  const conversations =
    Array.from(groups.values());


  /**
   * Messages should render oldest -> newest
   * inside an individual conversation.
   */
  for (const conversation of conversations) {
    conversation.msgs.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() -
        new Date(b.createdAt).getTime(),
    );

    const latest =
      conversation.msgs[
        conversation.msgs.length - 1
      ];

    if (latest) {
      conversation.preview =
        latest.text || "";

      conversation.time =
        messageTime(latest.createdAt);

      conversation.latestCreatedAt =
        latest.createdAt;
    }
  }


  /**
   * Conversations themselves:
   * newest conversation first.
   */
  conversations.sort(
    (a, b) =>
      new Date(
        b.latestCreatedAt || 0,
      ).getTime() -
      new Date(
        a.latestCreatedAt || 0,
      ).getTime(),
  );


  return conversations;
}


/**
 * Load conversations from PostgreSQL.
 */
async function loadMessages(root) {
  if (mState.loading) {
    return;
  }

  mState.loading = true;

  try {
    const rows =
      await fetchMessages();

    mState.conversations =
      buildConversations(rows);

    /**
     * You can continue exposing them through DB
     * if other parts of the dashboard depend on it.
     *
     * PostgreSQL remains the actual source of truth.
     */
    DB.conversations =
      mState.conversations;

    if (
      mState.active >=
      mState.conversations.length
    ) {
      mState.active = 0;
    }

    mState.loaded = true;
  } catch (error) {
    console.error(
      "Failed loading messages:",
      error,
    );

    UI.toast(
      error?.message ||
      "Could not load messages",
      "error",
    );

    mState.conversations = [];
  } finally {
    mState.loading = false;
  }


  if (!root) {
    return;
  }

  root.innerHTML =
    Pages.messages.render();

  UI.hydrate();

  Pages.messages.mount(
    root,
    true,
  );
}


/**
 * Find parent details from DB.parents
 * for starting a brand new conversation.
 */
function availableParents() {
  const parents = Array.isArray(DB.parents)
    ? DB.parents
    : [];

  return parents
    .map(parent => {
      const parentAccountId =
        parent.parentAccountId ||
        parent.accountId ||
        parent.id;

      return {
        ...parent,
        parentAccountId,
      };
    })
    .filter(parent =>
      Boolean(parent.parentAccountId),
    );
}


/**
 * Start a new conversation.
 */
function newParentMessageModal(root) {
  const parents =
    availableParents();

  if (!parents.length) {
    UI.toast(
      "No parent accounts are available.",
      "alert",
    );

    return;
  }


  UI.modal({
    title: "New Message",

    body: `
      <div class="field">
        <label>Parent</label>

        <select data-parent>
          ${parents
            .map(
              parent => `
                <option value="${esc(
                  parent.parentAccountId,
                )}">
                  ${esc(
                    parent.name ||
                    parent.email ||
                    "Parent",
                  )}
                  ${
                    parent.email
                      ? ` — ${esc(
                          parent.email,
                        )}`
                      : ""
                  }
                </option>
              `,
            )
            .join("")}
        </select>
      </div>

      <div class="field">
        <label>Message</label>

        <textarea
          data-body
          maxlength="4000"
          placeholder="Write your message…"
          style="min-height:130px"
        ></textarea>
      </div>
    `,

    foot: `
      <button
        class="btn btn-ghost"
        data-cancel
      >
        Cancel
      </button>

      <button
        class="btn btn-primary"
        data-send
      >
        ${MCIcon("send")}
        Send Message
      </button>
    `,

    mount(modalRoot, close) {
      const parentSelect =
        modalRoot.querySelector(
          "[data-parent]",
        );

      const body =
        modalRoot.querySelector(
          "[data-body]",
        );

      const cancel =
        modalRoot.querySelector(
          "[data-cancel]",
        );

      const send =
        modalRoot.querySelector(
          "[data-send]",
        );


      cancel?.addEventListener(
        "click",
        close,
      );


      send?.addEventListener(
        "click",
        async () => {
          const parentAccountId =
            parentSelect?.value;

          const text =
            body?.value?.trim();

          if (!parentAccountId) {
            UI.toast(
              "Select a parent.",
              "alert",
            );

            return;
          }

          if (!text) {
            UI.toast(
              "Write a message first.",
              "alert",
            );

            return;
          }


          send.disabled = true;


          try {
            await sendSchoolMessage(
              parentAccountId,
              text,
            );

            close();

            /**
             * Reload from database after successful send.
             */
            mState.loaded = false;

            await loadMessages(
              document.getElementById(
                "content",
              ) || root,
            );

            /**
             * Select the conversation we just sent to.
             */
            const index =
              mState.conversations.findIndex(
                conversation =>
                  conversation.parentAccountId ===
                  parentAccountId,
              );

            if (index >= 0) {
              mState.active =
                index;

              const content =
                document.getElementById(
                  "content",
                );

              if (content) {
                content.innerHTML =
                  Pages.messages.render();

                UI.hydrate();

                Pages.messages.mount(
                  content,
                  true,
                );
              }
            }


            UI.toast(
              "Message sent",
              "success",
            );
          } catch (error) {
            console.error(
              "Failed sending message:",
              error,
            );

            UI.toast(
              error?.message ||
              "Could not send message",
              "error",
            );
          } finally {
            send.disabled =
              false;
          }
        },
      );
    },
  });
}


/**
 * Send message through backend.
 */
async function sendSchoolMessage(
  parentAccountId,
  body,
) {
  const response = await fetch(
    "/api/mobile-admin/messages",
    {
      method: "POST",

      credentials: "include",

      headers: {
        "Content-Type":
          "application/json",

        Accept:
          "application/json",
      },

      body: JSON.stringify({
        parentAccountId,
        body,
      }),
    },
  );


  let json;

  try {
    json = await response.json();
  } catch {
    throw new Error(
      "The messages server returned an invalid response.",
    );
  }


  if (
    !response.ok ||
    json?.ok === false
  ) {
    throw new Error(
      json?.error?.message ||
      "Could not send message.",
    );
  }


  return Array.isArray(json?.data)
    ? json.data[0]
    : json?.data;
}


/**
 * Messages Page
 */
Pages.messages = {
  render() {
    /**
     * Initial loading state.
     */
    if (
      !mState.loaded &&
      !mState.loading
    ) {
      return `
        ${UI.pageHead(
          "Messages",
          "Two-way chat between schools and families — synced with the parent app.",
          `
            <button
              class="btn btn-primary"
              id="newMsg"
            >
              ${MCIcon("plus")}
              New Message
            </button>
          `,
        )}

        <div class="card">
          <div
            class="card-body"
            style="
              padding:40px;
              text-align:center;
            "
          >
            <div
              style="
                font-weight:700;
                margin-bottom:6px;
              "
            >
              Loading messages…
            </div>

            <div class="small muted">
              Syncing conversations from the server.
            </div>
          </div>
        </div>
      `;
    }


    const convs =
      mState.conversations || [];


    /**
     * No conversations.
     */
    if (!convs.length) {
      return `
        ${UI.pageHead(
          "Messages",
          "Two-way chat between schools and families — synced with the parent app.",
          `
            <button
              class="btn btn-primary"
              id="newMsg"
            >
              ${MCIcon("plus")}
              New Message
            </button>
          `,
        )}

        <div class="card">
          <div
            class="card-body"
            style="
              padding:55px 24px;
              text-align:center;
            "
          >
            <div
              style="
                width:48px;
                height:48px;
                display:flex;
                align-items:center;
                justify-content:center;
                margin:0 auto 14px;
                border-radius:14px;
                background:var(--purple-50);
                color:var(--purple-600);
              "
            >
              ${MCIcon("messages")}
            </div>

            <h3
              style="
                margin-bottom:6px;
              "
            >
              No messages yet
            </h3>

            <p
              class="muted"
              style="
                margin-bottom:18px;
              "
            >
              Start a conversation with a parent.
            </p>

            <button
              class="btn btn-primary"
              id="emptyNewMsg"
            >
              ${MCIcon("plus")}
              New Message
            </button>
          </div>
        </div>
      `;
    }


    /**
     * Ensure active index is valid.
     */
    const activeIndex =
      Math.min(
        mState.active,
        convs.length - 1,
      );

    const c =
      convs[activeIndex];


    return `
      ${UI.pageHead(
        "Messages",
        "Two-way chat between schools and families — synced with the parent app.",
        `
          <button
            class="btn btn-primary"
            id="newMsg"
          >
            ${MCIcon("plus")}
            New Message
          </button>
        `,
      )}

      <div class="card">
        <div class="chat-layout">

          <!-- Conversation list -->
          <div class="chat-list">

            ${convs
              .map(
                (cv, i) => `
                  <div
                    class="chat-item ${
                      i === activeIndex
                        ? "on"
                        : ""
                    }"
                    data-conv="${i}"
                  >

                    ${UI.avatar(
                      cv.who,
                    )}

                    <div class="c-txt">

                      <div class="c-top">
                        <span class="c-nm">
                          ${esc(
                            cv.who,
                          )}
                        </span>

                        <span class="c-time">
                          ${esc(
                            cv.time ||
                            "",
                          )}
                        </span>
                      </div>

                      <div class="c-prev">
                        ${esc(
                          cv.preview ||
                          "",
                        )}
                      </div>

                    </div>

                    ${
                      cv.unread
                        ? `
                          <span class="c-unread">
                            ${cv.unread}
                          </span>
                        `
                        : ""
                    }

                  </div>
                `,
              )
              .join("")}

          </div>


          <!-- Active conversation -->
          <div class="chat-pane">

            <div class="chat-head">

              ${UI.avatar(
                c.who,
              )}

              <div>
                <div
                  style="
                    font-weight:700;
                    color:var(--ink-900);
                  "
                >
                  ${esc(
                    c.who,
                  )}
                </div>

                <div class="small muted">
                  ${
                    c.email
                      ? esc(
                          c.email,
                        )
                      : esc(
                          c.school,
                        )
                  }
                </div>
              </div>

              <span
                style="
                  margin-left:auto;
                  display:flex;
                  gap:6px;
                "
              >

                <button
                  class="icon-btn"
                  title="Refresh"
                  id="refreshMessages"
                >
                  ${MCIcon(
                    "refresh",
                  )}
                </button>

                <button
                  class="icon-btn"
                  title="Information"
                >
                  ${MCIcon(
                    "info",
                  )}
                </button>

              </span>
            </div>


            <!-- Messages -->
            <div
              class="chat-msgs"
              id="chatMsgs"
            >

              ${c.msgs
                .map(
                  message => `
                    <div
                      class="msg ${message.dir}"
                      data-message-id="${esc(
                        message.id ||
                        "",
                      )}"
                    >

                      ${esc(
                        message.text ||
                        "",
                      )}

                      <span class="m-time">
                        ${esc(
                          message.time ||
                          "",
                        )}
                      </span>

                    </div>
                  `,
                )
                .join("")}

            </div>


            <!-- Composer -->
            <div class="chat-compose">

              <input
                id="chatInput"
                maxlength="4000"
                autocomplete="off"
                placeholder="Type a reply…"
              >

              <button
                class="btn btn-primary"
                id="chatSend"
              >
                ${MCIcon(
                  "send",
                )}
                Send
              </button>

            </div>

          </div>

        </div>
      </div>
    `;
  },


  mount(
    root,
    skipLoad = false,
  ) {
    if (!root) {
      return;
    }


    /**
     * Load from server the first time
     * the page opens.
     */
    if (
      !skipLoad &&
      !mState.loaded
    ) {
      loadMessages(root);

      return;
    }


    /**
     * New message buttons.
     */
    root
      .querySelector("#newMsg")
      ?.addEventListener(
        "click",
        () =>
          newParentMessageModal(
            root,
          ),
      );


    root
      .querySelector(
        "#emptyNewMsg",
      )
      ?.addEventListener(
        "click",
        () =>
          newParentMessageModal(
            root,
          ),
      );


    /**
     * Change active conversation.
     */
    root
      .querySelectorAll(
        "[data-conv]",
      )
      .forEach(element => {
        element.addEventListener(
          "click",
          () => {
            const index =
              Number(
                element.dataset.conv,
              );

            if (
              Number.isNaN(index)
            ) {
              return;
            }


            mState.active =
              index;


            /**
             * Locally clear unread badge.
             *
             * If you later create a backend "mark read"
             * endpoint, call it here too.
             */
            if (
              mState.conversations[
                index
              ]
            ) {
              mState.conversations[
                index
              ].unread = 0;
            }


            root.innerHTML =
              Pages.messages.render();

            UI.hydrate();

            Pages.messages.mount(
              root,
              true,
            );
          },
        );
      });


    /**
     * Refresh button.
     */
    root
      .querySelector(
        "#refreshMessages",
      )
      ?.addEventListener(
        "click",
        async () => {
          mState.loaded =
            false;

          await loadMessages(
            root,
          );
        },
      );


    const input =
      root.querySelector(
        "#chatInput",
      );

    const sendButton =
      root.querySelector(
        "#chatSend",
      );


    /**
     * Send reply in current conversation.
     */
    const send = async () => {
      if (!input) {
        return;
      }


      const text =
        input.value.trim();


      if (!text) {
        return;
      }


      const conversation =
        mState.conversations[
          mState.active
        ];


      if (
        !conversation ||
        !conversation.parentAccountId
      ) {
        UI.toast(
          "This conversation does not have a parent account.",
          "error",
        );

        return;
      }


      input.disabled =
        true;

      if (sendButton) {
        sendButton.disabled =
          true;
      }


      try {
        const newMessage =
          await sendSchoolMessage(
            conversation.parentAccountId,
            text,
          );


        /**
         * Immediately add successful database response
         * to the UI.
         */
        const createdAt =
          newMessage?.createdAt ||
          new Date().toISOString();


        conversation.msgs.push({
          id:
            newMessage?.id ||
            `temp-${Date.now()}`,

          dir: "out",

          text:
            newMessage?.body ||
            text,

          time:
            fullMessageTime(
              createdAt,
            ),

          createdAt,

          senderType:
            "SCHOOL",

          senderName:
            newMessage?.senderName ||
            "",

          readAt: null,
        });


        conversation.preview =
          text;

        conversation.time =
          messageTime(
            createdAt,
          );

        conversation.latestCreatedAt =
          createdAt;


        input.value =
          "";


        /**
         * Re-render.
         */
        root.innerHTML =
          Pages.messages.render();

        UI.hydrate();

        Pages.messages.mount(
          root,
          true,
        );


        /**
         * Scroll down.
         */
        const newBox =
          root.querySelector(
            "#chatMsgs",
          );

        if (newBox) {
          newBox.scrollTop =
            newBox.scrollHeight;
        }
      } catch (error) {
        console.error(
          "Could not send message:",
          error,
        );

        UI.toast(
          error?.message ||
          "Could not send message",
          "error",
        );
      } finally {
        /**
         * Elements may have been replaced
         * after successful render, so only mutate
         * them if still connected.
         */
        if (
          input &&
          input.isConnected
        ) {
          input.disabled =
            false;
        }

        if (
          sendButton &&
          sendButton.isConnected
        ) {
          sendButton.disabled =
            false;
        }
      }
    };


    sendButton
      ?.addEventListener(
        "click",
        send,
      );


    input
      ?.addEventListener(
        "keydown",
        event => {
          if (
            event.key ===
              "Enter" &&
            !event.shiftKey
          ) {
            event.preventDefault();

            send();
          }
        },
      );


    /**
     * Automatically scroll to newest message.
     */
    const box =
      root.querySelector(
        "#chatMsgs",
      );

    if (box) {
      box.scrollTop =
        box.scrollHeight;
    }
  },
};

  function audienceFields(){
    return `<div class="field"><label>Send to</label>
      <select data-f="aud"><option>All campuses</option>${DB.liveBranches().map(b=>`<option>${esc(b.name)}</option>`).join('')}<option>Specific grade</option><option>Specific class</option><option>Specific parents</option><option>All teachers</option></select></div>`;
  }
  // Rough audience size for realistic delivery numbers
  function audSize(aud){
    if(aud==='All campuses') return DB.totals.parents;
    const b=DB.branches.find(x=>x.name===aud);
    if(b) return Math.round(b.students*0.78);
    return aud==='All teachers'?DB.totals.teachers:DB.ri(40,160);
  }
  function composeModal(kind,onSend){
    UI.modal({
      title:'New '+kind,
      body:`${audienceFields()}
        <div class="field"><label>${kind==='SMS'?'Message (160 chars)':'Subject'}</label><input type="text" data-f="subject" placeholder="${kind==='SMS'?'Type your SMS…':'Subject line'}"></div>
        ${kind!=='SMS'?`<div class="field"><label>Message</label><textarea data-f="body" placeholder="Write your ${kind.toLowerCase()}…"></textarea></div>`:''}
        ${kind==='Push Notification'?`<div class="field"><label>Schedule for (optional)</label><input type="datetime-local" data-f="scheduledAt"><div class="hint">Leave empty to send immediately.</div></div>`:''}`,
      foot:`<button class="btn btn-ghost" data-x>Cancel</button>
            <button class="btn btn-ghost" data-d>${MCIcon('file')} Save Draft</button>
            <button class="btn btn-primary" data-s>${MCIcon('send')} Send</button>`,
      mount(r,close){
        r.querySelector('[data-x]').addEventListener('click',close);
        r.querySelector('[data-d]').addEventListener('click',()=>{close();UI.toast(kind+' saved to drafts');});
        r.querySelector('[data-s]').addEventListener('click',async()=>{
          const v=UI.formVals(r);
          if(!v.subject){UI.toast('Write something first','alert');return;}
          try{
            if(onSend) await onSend(v);
          }catch(error){ UI.toast(error.message||'Could not send notification','error'); return; }
          close();
          DB.log('Sent '+kind.toLowerCase(),v.subject+' → '+v.aud,'ok');
          UI.toast(kind+' sent to '+v.aud+' 🎉');
          App.refresh();
        });
      }
    });
  }

  function newsletterStudio(){
    const defaultIntro='The latest highlights, opportunities and moments from your Mobsie community — all in one place.';
    UI.modal({
      title:'Newsletter Studio',
      body:`<div class="newsletter-studio">
        <div class="newsletter-studio__intro"><div><h2>Create a campus newsletter</h2><p>A repeatable Mobsie structure — populate the fields, review the email, and send.</p></div><div class="newsletter-steps"><b>01 Content</b><span>→</span><span>02 Review</span><span>→</span><span>03 Send</span></div></div>
        <div class="newsletter-studio__grid">
          <section class="newsletter-editor"><div class="newsletter-panel-head"><h3>Newsletter details</h3><span>* Required fields</span></div><div class="newsletter-editor__body">
            <div class="newsletter-section-label">Delivery</div><div class="field"><label>Send to *</label><select data-f="audience"><option>All campuses</option>${DB.liveBranches().map(b=>`<option>${esc(b.name)}</option>`).join('')}</select></div><div class="field newsletter-field--wide"><label>Subject line *</label><input data-f="subject" value="What's happening at Mobsie"></div>
            <div class="newsletter-section-label">Header &amp; hero</div><div class="field"><label>Header image <span class="muted">(optional)</span></label><label class="newsletter-upload">${MCIcon('upload')}<span><b>Upload a header banner</b><small>Recommended: 1200 × 320 px</small></span><input type="file" data-img="header" accept="image/png,image/jpeg,image/webp"></label></div>
            <div class="field newsletter-field--wide"><label>Hero heading *</label><input data-f="heroTitle" value="Your campus, in the know."></div><div class="field"><label>Intro copy *</label><textarea data-f="intro">${defaultIntro}</textarea></div>
            <div class="newsletter-section-label">Featured story</div><div class="field"><label>Featured image</label><label class="newsletter-upload">${MCIcon('gallery')}<span><b>Add a featured image</b><small>Recommended: 1200 × 700 px</small></span><input type="file" data-img="feature" accept="image/png,image/jpeg,image/webp"></label></div>
            <div class="field newsletter-field--wide"><label>Feature headline</label><input data-f="featureTitle" value="There's more to discover this week"></div><div class="field"><label>Feature copy</label><textarea data-f="featureCopy">Share the update that matters most and give your community a clear next step.</textarea></div>
            <div class="form-row"><div class="field"><label>Button label</label><input data-f="ctaText" value="Open Mobsie"></div><div class="field"><label>Button link</label><input type="url" data-f="ctaLink" value="https://mobsie.app"></div></div>
            <div class="newsletter-section-label">Footer</div><div class="field"><label>Footer message</label><textarea data-f="footer">You are receiving this email because you are part of the Mobsie community.</textarea></div>
          </div></section>
          <section class="newsletter-preview-panel"><div class="newsletter-panel-head"><h3>Live email preview</h3><span class="newsletter-device">Desktop · 600px</span></div><div class="newsletter-preview-wrap"><article class="newsletter-email">
            <header><img class="newsletter-brand-logo" src="/mobsie-logo.png" alt="Mobsie Connect"><span>News &amp; updates</span></header><div class="newsletter-hero" data-preview="hero"><h2 data-preview="heroTitle">Your campus, in the know.</h2></div>
            <div class="newsletter-email__body"><h2 data-preview="featureTitle">There's more to discover this week</h2><p data-preview="intro">${defaultIntro}</p><div class="newsletter-feature-image" data-preview="featureImage"><span>M</span></div><p data-preview="featureCopy">Share the update that matters most and give your community a clear next step.</p><a data-preview="cta">Open Mobsie</a></div>
            <footer><img class="newsletter-footer-logo" src="/mobsie-logo.png" alt="Mobsie Connect"><p data-preview="footer">You are receiving this email because you are part of the Mobsie community.</p><small>Manage preferences · Unsubscribe</small></footer>
          </article></div></section>
        </div></div>`,
      foot:`<button class="btn btn-ghost" data-d>Save draft</button><button class="btn btn-primary" data-s>Send newsletter →</button>`,
      mount(root,close){
        const form=root.querySelector('.newsletter-studio');
        const value=name=>form.querySelector(`[data-f="${name}"]`).value.trim();
        const preview=(name,text)=>{const node=form.querySelector(`[data-preview="${name}"]`);if(node)node.textContent=text;};
        const sync=()=>{preview('heroTitle',value('heroTitle')||'Your campus, in the know.');preview('featureTitle',value('featureTitle')||'Newsletter update');preview('intro',value('intro'));preview('featureCopy',value('featureCopy'));preview('footer',value('footer'));const cta=form.querySelector('[data-preview="cta"]');cta.textContent=value('ctaText')||'Open Mobsie';cta.href=value('ctaLink')||'#';};
        form.querySelectorAll('[data-f]').forEach(input=>input.addEventListener('input',sync));
        form.querySelectorAll('[data-img]').forEach(input=>input.addEventListener('change',()=>{const file=input.files[0];if(!file)return;const url=URL.createObjectURL(file);if(input.dataset.img==='header'){const hero=form.querySelector('[data-preview="hero"]');hero.style.backgroundImage=`linear-gradient(90deg,rgba(124,58,237,.78),rgba(249,115,22,.72)),url(${url})`;}else{const image=form.querySelector('[data-preview="featureImage"]');image.style.backgroundImage=`url(${url})`;image.classList.add('has-image');}input.closest('.newsletter-upload').querySelector('b').textContent=file.name;}));
        const uploadImage=async input=>{const file=input.files[0];if(!file)return {url:'',publicId:''};if(file.size>8*1024*1024)throw new Error(`${file.name} is larger than 8 MB.`);const fileData=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});const response=await MobsieApi.mutate('/api/uploads',{method:'POST',body:JSON.stringify({fileData,originalName:file.name,purpose:'newsletters'})});return {url:response.data.url,publicId:response.data.publicId};};
        const save=async status=>{
          const subject=value('subject'),heroTitle=value('heroTitle'),intro=value('intro');if(!subject||!heroTitle||!intro){UI.toast('Subject, hero heading and intro copy are required','alert');return;}
          const button=root.querySelector(status==='DRAFT'?'[data-d]':'[data-s]');button.disabled=true;button.textContent=status==='DRAFT'?'Saving…':'Sending…';
          try{const audience=value('audience');const [headerImage,featureImage]=await Promise.all([uploadImage(form.querySelector('[data-img="header"]')),uploadImage(form.querySelector('[data-img="feature"]'))]);const content={heroTitle,intro,featureTitle:value('featureTitle'),featureCopy:value('featureCopy'),ctaText:value('ctaText'),ctaLink:value('ctaLink'),headerImageUrl:headerImage.url,headerImagePublicId:headerImage.publicId,featureImageUrl:featureImage.url,featureImagePublicId:featureImage.publicId,footer:value('footer')};const response=await MobsieApi.mutate('/api/newsletters',{method:'POST',body:JSON.stringify({title:subject,body:[intro,content.featureCopy].filter(Boolean).join('\n\n'),audience,status,content})});const saved=response.data?.[0]||{};DB.newsletters.unshift({id:saved.id,title:subject,subject,body:saved.body,audience,sent:status==='SENT'?'Just now':'—',publishedAt:saved.publishedAt,recipients:0,openRate:0,status:status==='SENT'?'Sent':'Draft',content});close();UI.toast(status==='SENT'?'Newsletter sent to '+audience:'Newsletter draft saved');App.refresh();}catch(error){button.disabled=false;button.textContent=status==='DRAFT'?'Save draft':'Send newsletter →';UI.toast(error.message||'Could not save newsletter','alert');}
        };
        root.querySelector('[data-d]').addEventListener('click',()=>save('DRAFT'));root.querySelector('[data-s]').addEventListener('click',()=>save('SENT'));sync();
      }
    });
  }

  /* ---------- Newsletters ---------- */
  Pages.newsletters={
    render(){
      const sent=DB.newsletters.filter(n=>n.status==='Sent');
      const recipients=sent.reduce((sum,n)=>sum+Number(n.recipients||0),0);
      const avgOpen=sent.length?Math.round(sent.reduce((sum,n)=>sum+Number(n.openRate||0),0)/sent.length):0;
      const tbl=UI.table({
        pageSize:8, rows:DB.newsletters,
        onRow:n=>{const content=n.content||{};return UI.drawer({
          title:n.title,
          body:`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">${UI.status(n.status)} ${UI.badge(n.audience||'All campuses','purple')}</div>
            ${UI.dl([['Published',esc(n.sent||'—')],['Recipients',n.recipients?F(n.recipients):'Not tracked'],['Open rate',n.openRate?`${n.openRate}%`:'Not tracked']])}
            <div class="divider"></div>${Object.keys(content).length?`<div class="newsletter-saved-preview"><div class="newsletter-saved-brand"><img src="/mobsie-logo.png" alt="Mobsie Connect"><span>News &amp; updates</span></div><div class="newsletter-saved-hero" ${content.headerImageUrl?`style="background-image:linear-gradient(90deg,rgba(124,58,237,.72),rgba(249,115,22,.68)),url('${esc(content.headerImageUrl)}')"`:''}><b>${esc(content.heroTitle||n.title)}</b></div><div class="newsletter-saved-body"><h3>${esc(content.featureTitle||n.title)}</h3><p>${esc(content.intro||n.body||'')}</p>${content.featureImageUrl?`<img src="${esc(content.featureImageUrl)}" alt="">`:''}<p>${esc(content.featureCopy||'')}</p>${content.ctaText?`<a href="${esc(content.ctaLink||'#')}" target="_blank" rel="noopener">${esc(content.ctaText)}</a>`:''}</div><footer class="newsletter-saved-footer"><img src="/mobsie-logo.png" alt="Mobsie Connect"><p>${esc(content.footer||'')}</p></footer></div>`:`<h4 style="margin:0 0 8px">Newsletter message</h4><div style="white-space:pre-wrap;line-height:1.65;color:var(--ink-700)">${esc(n.body||n.message||'No message content is available.')}</div>`}`,
          foot:n.url?`<a class="btn btn-primary" href="${esc(n.url)}" target="_blank" rel="noopener">${MCIcon('eye')} Open attachment</a>`:''
        })},
        columns:[
          {key:'title',label:'Newsletter',render:r=>`<div class="cell-main">${esc(r.title)}</div><div class="cell-sub">${esc(r.audience)}</div>`},
          {key:'sent',label:'Sent'},
          {key:'recipients',label:'Recipients',num:true,render:r=>r.recipients?F(r.recipients):'—'},
          {key:'openRate',label:'Open rate',render:r=>r.status==='Draft'?'—':`<div style="display:flex;align-items:center;gap:10px;min-width:130px"><span class="meter purple"><i style="width:${r.openRate}%"></i></span><b style="font-variant-numeric:tabular-nums">${r.openRate}%</b></div>`},
          {key:'status',label:'Status',render:r=>UI.status(r.status)},
          {label:'',sortable:false,render:()=>`<button class="icon-btn">${MCIcon('chevRight')}</button>`},
        ],
      });
      return `
        ${UI.pageHead('Newsletters','Beautiful branded newsletters delivered to the app and inbox.',
          `<button class="btn btn-purple" id="newNl">${MCIcon('plus')} Compose Newsletter</button>`)}
        <div class="grid cards-4" style="margin-bottom:20px">
          ${UI.statCard({icon:'newsletters',tint:'t-purple',label:'Published',value:String(sent.length),deltaHtml:`<span class="delta flat">saved in Neon</span>`})}
          ${UI.statCard({icon:'eye',tint:'t-blue',label:'Avg Open Rate',value:avgOpen?avgOpen+'%':'—',deltaHtml:`<span class="delta flat">${avgOpen?'tracked sends':'analytics not yet available'}</span>`})}
          ${UI.statCard({icon:'parents',tint:'t-green',label:'Recipients',value:recipients?F(recipients):'—',deltaHtml:`<span class="delta flat">${recipients?'across published newsletters':'not yet tracked'}</span>`})}
          ${UI.statCard({icon:'file',tint:'t-amber',label:'Drafts',value:String(DB.newsletters.filter(n=>n.status==='Draft').length),deltaHtml:`<span class="delta flat">not published</span>`})}
        </div>
        <div class="card"><div class="card-head"><div><h3>All newsletters</h3></div></div>
          <div class="card-body" style="padding:0;padding-top:8px">${tbl}</div></div>`;
    },
    mount(root){
      root.querySelector('#newNl').addEventListener('click',newsletterStudio);
    }
  };

  /* ---------- Push notifications ---------- */
  Pages.push={
    render(){
      const delivered=DB.pushLog.reduce((sum,n)=>sum+Number(n.delivered||0),0);
      const opened=DB.pushLog.reduce((sum,n)=>sum+Number(n.opened||0),0);
      const deliveredRows=DB.pushLog.filter(n=>String(n.status).toLowerCase()==='delivered');
      const tbl=UI.table({
        pageSize:8, rows:DB.pushLog,
        onRow:n=>UI.drawer({
          title:n.title,
          body:`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">${UI.status(n.status)} ${UI.badge(n.audience||'All campuses','orange')}</div>
            ${UI.dl([['Sent / scheduled',esc(n.time||'—')],['Delivered',F(Number(n.delivered||0))],['Opened',F(Number(n.opened||0))],['Open rate',n.delivered?Math.round(n.opened/n.delivered*100)+'%':'—']])}
            <div class="divider"></div><h4 style="margin:0 0 8px">Notification message</h4><div style="white-space:pre-wrap;line-height:1.65;color:var(--ink-700)">${esc(n.body||n.message||n.title)}</div>`
        }),
        columns:[
          {key:'title',label:'Notification',render:r=>`<div class="cell-main">${esc(r.title)}</div><div class="cell-sub">${esc(r.audience)}</div>`},
          {key:'time',label:'Sent'},
          {key:'delivered',label:'Delivered',num:true,render:r=>F(r.delivered)},
          {key:'opened',label:'Opened',num:true,render:r=>`${F(r.opened)} <span class="muted">(${Math.round(r.opened/r.delivered*100)}%)</span>`},
          {key:'status',label:'Status',render:r=>UI.status(r.status)},
        ],
      });
      return `
        ${UI.pageHead('Push Notifications','Instant alerts straight to parents\' phones.',
          `<button class="btn btn-primary" id="newPush">${MCIcon('push')} Send Push</button>`)}
        <div class="grid cards-4" style="margin-bottom:20px">
          ${UI.statCard({icon:'push',tint:'t-orange',label:'Notifications',value:F(DB.pushLog.length),deltaHtml:`<span class="delta flat">${deliveredRows.length} delivered</span>`})}
          ${UI.statCard({icon:'check',tint:'t-green',label:'Delivered',value:F(delivered),deltaHtml:`<span class="delta flat">recorded devices</span>`})}
          ${UI.statCard({icon:'eye',tint:'t-purple',label:'Opened',value:F(opened),deltaHtml:`<span class="delta flat">${delivered?Math.round(opened/delivered*100)+'% open rate':'no delivery data'}</span>`})}
          ${UI.statCard({icon:'clock',tint:'t-blue',label:'Scheduled',value:String(DB.pushLog.filter(n=>n.status==='Scheduled').length),deltaHtml:`<span class="delta flat">waiting to send</span>`})}
        </div>
        <div class="card"><div class="card-head"><div><h3>Recent notifications</h3></div></div>
          <div class="card-body" style="padding:0;padding-top:8px">${tbl}</div></div>`;
    },
    mount(root){
      root.querySelector('#newPush').addEventListener('click',()=>composeModal('Push Notification',async v=>{
        const result=await MobsieApi.mutate('/api/mobile-admin/push',{
          method:'POST',body:JSON.stringify({title:v.subject,body:v.body||v.subject,audience:v.aud,scheduledAt:v.scheduledAt?new Date(v.scheduledAt).toISOString():null})
        });
        const delivery=result.data?.sent??0;
        const n=audSize(v.aud);
        DB.pushLog.unshift({title:v.subject,body:v.body||v.subject,message:v.body||v.subject,audience:v.aud,time:v.scheduledAt?new Date(v.scheduledAt).toLocaleString():'Just now',
          delivered:delivery,opened:0,status:v.scheduledAt?'Scheduled':'Delivered'});
        DB.save();
      }));
    }
  };

  /* ---------- SMS ---------- */
  Pages.sms={
    render(){
      const tbl=UI.table({
        pageSize:8, rows:DB.smsLog,
        columns:[
          {key:'to',label:'Audience',render:r=>`<span class="cell-main">${esc(r.to)}</span>`},
          {key:'msg',label:'Message',render:r=>`<span style="white-space:normal;display:block;max-width:380px">${esc(r.msg)}</span>`},
          {key:'time',label:'Sent'},
          {key:'count',label:'Recipients',num:true,render:r=>F(r.count)},
          {key:'status',label:'Status',render:r=>UI.status(r.status)},
        ],
      });
      return `
        ${UI.pageHead('SMS','For urgent word — reaches every phone, app or no app.',
          `<button class="btn btn-ghost" id="buyCred">${MCIcon('plus')} Buy Credits</button>
           <button class="btn btn-primary" id="newSms">${MCIcon('sms')} Send SMS</button>`)}
        <div class="grid cards-4" style="margin-bottom:20px">
          ${UI.statCard({icon:'sms',tint:'t-blue',label:'Credits Remaining',value:F(4820),deltaHtml:`<span class="delta flat">≈ 6 full-school sends</span>`})}
          ${UI.statCard({icon:'send',tint:'t-orange',label:'Sent This Month',value:F(DB.smsLog.reduce((a,s)=>a+s.count,0)+180),deltaHtml:UI.delta(4,'down','app adoption rising')})}
          ${UI.statCard({icon:'check',tint:'t-green',label:'Delivery Rate',value:'98.7%',deltaHtml:`<span class="delta flat">1 carrier degraded</span>`})}
          ${UI.statCard({icon:'wallet',tint:'t-purple',label:'Cost This Month',value:'R184',deltaHtml:`<span class="delta flat">R0.30 / message</span>`})}
        </div>
        <div class="card"><div class="card-head"><div><h3>SMS log</h3></div></div>
          <div class="card-body" style="padding:0;padding-top:8px">${tbl}</div></div>`;
    },
    mount(root){
      root.querySelector('#newSms').addEventListener('click',()=>composeModal('SMS',v=>{
        DB.smsLog.unshift({to:v.aud,msg:v.subject,time:'Just now',count:audSize(v.aud),status:'Delivered'});
      }));
      root.querySelector('#buyCred').addEventListener('click',()=>UI.modal({
        title:'Buy SMS Credits',
        body:`<div class="field"><label>Bundle</label><select data-f="bundle"><option>1,000 credits — R300</option><option>5,000 credits — R1,400</option><option>10,000 credits — R2,600</option></select></div>
          <p class="small muted">Charged to the school's card on file. Credits never expire.</p>`,
        foot:`<button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-green" data-s>Purchase</button>`,
        mount(r,close){
          r.querySelector('[data-x]').addEventListener('click',close);
          r.querySelector('[data-s]').addEventListener('click',()=>{
            close();UI.toast('Credits added to your balance 🎉');
          });
        }
      }));
    }
  };

  /* ---------- Email campaigns ---------- */
  Pages.campaigns={
    render(){
      const tbl=UI.table({
        pageSize:8, rows:DB.campaigns,
        columns:[
          {key:'name',label:'Campaign',render:r=>`<div class="cell-main">${esc(r.name)}</div><div class="cell-sub">${esc(r.subject)}</div>`},
          {key:'audience',label:'Audience'},
          {key:'sent',label:'Sent',num:true,render:r=>F(r.sent)},
          {key:'openRate',label:'Opens',render:r=>`<div style="display:flex;align-items:center;gap:10px;min-width:120px"><span class="meter purple"><i style="width:${r.openRate}%"></i></span><b style="font-variant-numeric:tabular-nums">${r.openRate}%</b></div>`},
          {key:'clickRate',label:'Clicks',num:true,render:r=>r.clickRate+'%'},
          {key:'status',label:'Status',render:r=>UI.status(r.status)},
        ],
      });
      return `
        ${UI.pageHead('Email Campaigns','Marketing and engagement campaigns with real funnel numbers.',
          `<button class="btn btn-purple" id="newCamp">${MCIcon('campaigns')} New Campaign</button>`)}
        <div class="grid" style="grid-template-columns:1.5fr 1fr;margin-bottom:20px" id="campTop">
          ${UI.card('Campaign funnel — 2027 Enrolment Drive',Charts.funnel({stages:[
            {label:'Delivered',value:12408},{label:'Opened',value:5832},{label:'Clicked',value:1489},
            {label:'Started application',value:406},{label:'Applied',value:158}],
            ramp:['#4C1D95','#6D28D9','#7C3AED','#8B5CF6','#A78BFA']}),{sub:'Running · updated 5 min ago'})}
          ${UI.card('Engagement over time',`
            ${UI.legend([{color:'#7C3AED',label:'Open rate',line:true}])}
            <div class="chart-box" style="margin-top:6px">${Charts.line({labels:['Jan','Feb','Mar','Apr','May'],series:[{name:'Open rate',color:'#7C3AED',data:[48,52,55,61,64],fmt:v=>v+'%'}],height:196,money:false})}</div>`)}
        </div>
        <div class="card"><div class="card-head"><div><h3>All campaigns</h3></div></div>
          <div class="card-body" style="padding:0;padding-top:8px">${tbl}</div></div>
        <style>@media(max-width:1100px){#campTop{grid-template-columns:1fr}}</style>`;
    },
    mount(root){
      root.querySelector('#newCamp').addEventListener('click',()=>composeModal('Campaign',v=>{
        DB.campaigns.unshift({name:v.subject,subject:v.subject,audience:v.aud,
          sent:audSize(v.aud),openRate:0,clickRate:0,status:'Running'});
      }));
    }
  };

  /* ---------- Feedback Centre ---------- */
  Pages.feedback={
    render(){
      const stars=n=>Array.from({length:5},(_,i)=>`<span style="color:${i<n?'var(--amber-500)':'var(--ink-200)'};width:14px;display:inline-block">${MCIcon('star')}</span>`).join('');
      return `
        ${UI.pageHead('Feedback Centre','What families are saying — routed to the right school automatically.',
          `<button class="select">${MCIcon('filter')} All topics ${MCIcon('chevDown')}</button>`)}
        <div class="grid cards-4" style="margin-bottom:20px">
          ${UI.statCard({icon:'heart',tint:'t-pink',label:'CSAT Score',value:'4.6/5',deltaHtml:UI.delta(0.2,'up','vs last term').replace('0.2%','0.2')})}
          ${UI.statCard({icon:'feedback',tint:'t-orange',label:'New This Week',value:String(DB.feedback.filter(f=>f.status==='New').length),deltaHtml:`<span class="delta flat">${DB.feedback.filter(f=>f.status==='New').length} need response</span>`})}
          ${UI.statCard({icon:'clock',tint:'t-blue',label:'Avg Response Time',value:'4.2h',deltaHtml:UI.delta(12,'down','improving')})}
          ${UI.statCard({icon:'trendUp',tint:'t-green',label:'NPS',value:'+62',deltaHtml:`<span class="delta flat">world-class</span>`})}
        </div>
        <div class="grid cards-3">${DB.feedback.map(f=>`
          <div class="card" style="padding:18px">
            <div style="display:flex;align-items:center;gap:11px;margin-bottom:10px">
              ${UI.avatar(f.who)}
              <div style="min-width:0"><div style="font-weight:700;color:var(--ink-900);font-size:13.5px">${esc(f.who)}</div>
              <div class="small muted">${esc(f.school)}</div></div>
              <span style="margin-left:auto">${UI.status(f.status)}</span>
            </div>
            <div style="display:flex;gap:1px;margin-bottom:8px">${stars(f.rating)}</div>
            <p style="font-size:13.5px;color:var(--ink-700);line-height:1.55">“${esc(f.text)}”</p>
            ${f.reply?`<div style="margin-top:12px;padding:12px;border-radius:12px;background:var(--green-50);font-size:12.5px;line-height:1.5"><strong>${esc(f.repliedByName||'Mobsie Kids')} replied:</strong><br>${esc(f.reply)}</div>`:''}
            <div class="divider" style="margin:12px 0 10px"></div>
            <div style="display:flex;align-items:center">
              ${UI.badge(f.topic,'purple')}
              <span class="small muted" style="margin-left:auto">${f.date}</span>
              <button class="btn btn-soft btn-sm" style="margin-left:10px" data-reply="${f.id}">Reply</button>
            </div>
          </div>`).join('')}</div>`;
    },
    mount(root){
      root.addEventListener('click',e=>{
        const b=e.target.closest('[data-reply]');
        if(!b) return;
        const f=DB.feedback.find(x=>x.id===b.dataset.reply);
        if(!f) return;
        UI.modal({
          title:'Reply to '+f.who,
          body:`<p class="small muted" style="margin-bottom:12px">“${esc(f.text)}”</p>
            <div class="field"><label>Your reply</label><textarea data-f="reply" placeholder="Thank the family and respond…"></textarea></div>`,
          foot:`<button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary" data-s>${MCIcon('send')} Send Reply</button>`,
          mount(r,close){
            r.querySelector('[data-x]').addEventListener('click',close);
            r.querySelector('[data-s]').addEventListener('click',async()=>{
              try{
                const reply=r.querySelector('[data-f="reply"]').value.trim();
                if(!reply){UI.toast('Type a reply first','alert');return;}
                await MobsieApi.mutate('/api/mobile-admin/feedback',{
                  method:'PUT',body:JSON.stringify({id:f.id,status:'RESOLVED',reply})
                });
                f.status='Responded';f.reply=reply;f.repliedByName='Mobsie Kids';f.repliedAt=new Date().toISOString();
                DB.log('Resolved feedback',f.id+' — '+f.who,'ok');
                close();UI.toast('Feedback marked as resolved');App.refresh();
              }catch(error){UI.toast(error.message,'error');}
            });
          }
        });
      });
    }
  };
})();
