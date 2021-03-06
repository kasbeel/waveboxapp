import Bootstrap from 'R/Bootstrap'
import querystring from 'querystring'
import { google } from 'googleapis'
import FetchService from 'shared/FetchService'

const gmail = google.gmail('v1')
const oauth2 = google.oauth2('v2')
const OAuth2 = google.auth.OAuth2
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = Bootstrap.credentials

class GoogleHTTP {
  /* **************************************************************************/
  // Utils
  /* **************************************************************************/

  /**
  * Rejects a call because the mailbox has no authentication info
  * @param info: any information we have
  * @return promise - rejected
  */
  static _rejectWithNoAuth (info) {
    return Promise.reject(new Error('Mailbox missing authentication information'))
  }

  /* **************************************************************************/
  // Auth
  /* **************************************************************************/

  /**
  * Generates the auth token object to use with Google
  * @param accessToken: the access token from the mailbox
  * @param refreshToken: the refresh token from the mailbox
  * @param expiryTime: the expiry time from the mailbox
  * @return the google auth object
  */
  static generateAuth (accessToken, refreshToken, expiryTime) {
    const auth = new OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
    auth.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: expiryTime
    })
    return auth
  }

  /**
  * Upgrades the initial temporary access code to a permenant access code
  * @param authCode: the temporary auth code
  * @param codeRedirectUri: the redirectUri that was used in getting the current code
  * @return promise
  */
  static upgradeAuthCodeToPermenant (authCode, codeRedirectUri) {
    return Promise.resolve()
      .then(() => window.fetch('https://accounts.google.com/o/oauth2/token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: querystring.stringify({
          code: authCode,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          grant_type: 'authorization_code',
          redirect_uri: codeRedirectUri
        })
      }))
      .then((res) => res.ok ? Promise.resolve(res) : Promise.reject(res))
      .then((res) => res.json())
      .then((res) => Object.assign({ date: new Date().getTime() }, res))
  }

  /* **************************************************************************/
  // Watch
  /* **************************************************************************/

  /**
  * Watches an account for changes
  * @param auth: the auth to access google with
  * @return promise
  */
  static watchAccount (auth) {
    if (!auth) { return this._rejectWithNoAuth() }

    return Promise.resolve()
      .then(() => {
        return Promise.resolve()
          .then(() => gmail.users.watch({
            userId: 'me',
            resource: {
              topicName: 'projects/wavebox-158310/topics/gmail'
            },
            auth: auth
          }))
          .catch((ex) => {
            if (ex && typeof (ex.message) === 'string' && ex.message.startsWith('Only one user push notification client allowed per developer')) {
              // This suggests we're connected elsewhere - nothing to really do here, just look success-y
              console.info('The failing status 400 call to https://www.googleapis.com/gmail/v1/users/me/watch is handled gracefully')
              return Promise.resolve({ status: 200, data: {} })
            } else {
              return Promise.reject(ex)
            }
          })
      })
      .then((res) => {
        if (res.status === 200) {
          return Promise.resolve(res.data)
        } else {
          return Promise.reject(new Error(`Invalid HTTP status code ${res.status}`))
        }
      })
  }

  /* **************************************************************************/
  // Profile
  /* **************************************************************************/

  /**
  * Syncs a profile for a mailbox
  * @param auth: the auth to access google with
  * @return promise
  */
  static fetchAccountProfile (auth) {
    if (!auth) { return this._rejectWithNoAuth() }

    return Promise.resolve()
      .then(() => oauth2.userinfo.get({ userId: 'me', auth: auth }))
      .then((res) => {
        if (res.status === 200) {
          return Promise.resolve(res.data)
        } else {
          return Promise.reject(new Error(`Invalid HTTP status code ${res.status}`))
        }
      })
  }

  /**
  * Fetches a profile for a mailbox but with the raw auth details from google
  * @param rawAuth: the raw auth credentials from google
  * @return promise
  */
  static fetchAccountProfileWithRawAuth (rawAuth) {
    const expiry = new Date().getTime() + rawAuth.expires_in
    const auth = GoogleHTTP.generateAuth(rawAuth.access_token, rawAuth.refresh_token, expiry)
    return GoogleHTTP.fetchAccountProfile(auth)
  }

  /* **************************************************************************/
  // Gmail
  /* **************************************************************************/

  /**
  * Gets the users profile
  * @param auth: the auth object to access API
  * @return promise
  */
  static fetchGmailProfile (auth) {
    if (!auth) { return this._rejectWithNoAuth() }

    return Promise.resolve()
      .then(() => gmail.users.getProfile({
        userId: 'me',
        auth: auth
      }))
      .then((res) => {
        if (res.status === 200) {
          return Promise.resolve(res.data)
        } else {
          return Promise.reject(new Error(`Invalid HTTP status code ${res.status}`))
        }
      })
  }

  /**
  * Fetches the history list of changes
  * @param auth: the auth objecto to access API
  * @param fromHistoryId: the start history id to get changes from
  * @return promise
  */
  static fetchGmailHistoryList (auth, fromHistoryId) {
    if (!auth) { return this._rejectWithNoAuth() }

    return Promise.resolve()
      .then(() => gmail.users.history.list({
        userId: 'me',
        startHistoryId: fromHistoryId,
        auth: auth
      }))
      .then((res) => {
        if (res.status === 200) {
          return Promise.resolve(res.data)
        } else {
          return Promise.reject(new Error(`Invalid HTTP status code ${res.status}`))
        }
      })
  }

  /* **************************************************************************/
  // Gmail: Labels
  /* **************************************************************************/

  /**
  * Syncs the label for a mailbox. The label is a cheap call which can be used
  * to decide if the mailbox has changed
  * @param auth: the auth to access google with
  * @param labelId: the id of the label to sync
  * @return promise
  */
  static fetchGmailLabel (auth, labelId) {
    if (!auth) { return this._rejectWithNoAuth() }

    return Promise.resolve()
      .then(() => gmail.users.labels.get({
        userId: 'me',
        id: labelId,
        auth: auth
      }))
      .then((res) => {
        if (res.status === 200) {
          return Promise.resolve(res.data)
        } else {
          return Promise.reject(new Error(`Invalid HTTP status code ${res.status}`))
        }
      })
  }

  /* **************************************************************************/
  // Gmail: Threads
  /* **************************************************************************/

  /**
  * Fetches the unread summaries for a mailbox
  * @param auth: the auth to access google with
  * @param query = undefined: the query to ask the server for
  * @param labelIds = []: a list of label ids to match on
  * @param limit=10: the limit on results to fetch
  * @return promise
  */
  static fetchGmailThreadHeadersList (auth, query = undefined, labelIds = [], limit = 25) {
    if (!auth) { return this._rejectWithNoAuth() }

    return Promise.resolve()
      .then(() => gmail.users.threads.list({
        userId: 'me',
        labelIds: labelIds,
        q: query,
        maxResults: limit,
        auth: auth
      }))
      .then((res) => {
        if (res.status === 200) {
          return Promise.resolve(res.data)
        } else {
          return Promise.reject(new Error(`Invalid HTTP status code ${res.status}`))
        }
      })
  }

  /**
  * Fetches an email from a given id
  * @param auth: the auth to access google with
  * @param threadId: the id of the thread
  * @return promise
  */
  static fetchGmailThread (auth, threadId) {
    if (!auth) { return this._rejectWithNoAuth() }

    return Promise.resolve()
      .then(() => gmail.users.threads.get({
        userId: 'me',
        id: threadId,
        auth: auth
      }))
      .then((res) => {
        if (res.status === 200) {
          return Promise.resolve(res.data)
        } else {
          return Promise.reject(new Error(`Invalid HTTP status code ${res.status}`))
        }
      })
  }

  /**
  * Fetches multiple emails email from a set of thread ids
  * @param auth: the auth to access google with
  * @param threadIds: the array of thread ids to fetch
  * @return promise
  */
  static fetchMultipleGmailThreads (auth, threadIds) {
    return Promise.all(threadIds.map((threadId) => {
      return this.fetchGmailThread(auth, threadId)
    }))
  }

  /**
  * Fetches the changed threads from the gmail server
  * @param auth: the auth to use with google
  * @param knownThreads: any currently known threads that don't need to be fetched in an object keyed by id
  * @param threadHeaders: the latest thread headers which will be used to fetch the full heads if required
  * @param postProcessThread=undefined: a function to post process a thread before returning it. This must leave historyId and id intact
  * @return promise: with the threads ordered by threadHeaders all full resolved
  */
  static fullyResolveGmailThreadHeaders (auth, knownThreads, threadHeaders, postProcessThread = undefined) {
    const changedThreadIds = threadHeaders
      .filter((threadHeader) => {
        const known = knownThreads[threadHeader.id]
        return !known || known.historyId !== threadHeader.historyId
      })
      .map((threadHeader) => threadHeader.id)

    return Promise.resolve()
      .then(() => GoogleHTTP.fetchMultipleGmailThreads(auth, changedThreadIds))
      .then((threads) => {
        return threads.reduce((acc, thread) => {
          acc[thread.id] = postProcessThread ? postProcessThread(thread) : thread
          return acc
        }, {})
      })
      .then((updatedThreads) => {
        return threadHeaders
          .map((threadHeader) => updatedThreads[threadHeader.id] || knownThreads[threadHeader.id])
          .filter((v) => !!v)
      })
  }

  /* **************************************************************************/
  // Gmail: Atom
  /* **************************************************************************/

  /**
  * Get an int from xml
  * @param el: the element to use
  * @param selector: the selector to use
  * @param defaultValue=undefinde: default value if the int is not found or invalid
  * @return int from the xml
  */
  static _atomXMLGetInt (el, selector, defaultValue = undefined) {
    const target = el.querySelector(selector)
    if (!target) { return defaultValue }

    const val = parseInt(target.textContent)
    if (isNaN(val)) { return defaultValue }

    return val
  }

  /**
  * Get a date from xml
  * @param el: the element to use
  * @param selector: the selector to use
  * @param defaultValue=undefinde: default value if the int is not found or invalid
  * @return Date from the xml
  */
  static _atomXMLGetDate (el, selector, defaultValue = undefined) {
    const target = el.querySelector(selector)
    if (!target) { return defaultValue }

    const val = new Date(target.textContent)
    if (isNaN(val)) { return defaultValue }

    return val
  }

  /**
  * Get a string from xml
  * @param el: the element to use
  * @param selector: the selector to use
  * @param defaultValue=undefinde: default value if the int is not found or invalid
  * @return string from the xml
  */
  static _atomXMLGetString (el, selector, defaultValue = undefined) {
    const target = el.querySelector(selector)
    if (!target) { return defaultValue }

    return target.textContent
  }

  /**
  * Get a parsed url from xml
  * @param el: the element to use
  * @param selector: the selector to use
  * @param defaultValue: the default value if the url is invalid
  * @return url from the xml
  */
  static _atomXMLGetUrl (el, selector, defaultValue = undefined) {
    const target = el.querySelector(selector)
    if (!target) { return defaultValue }

    let url
    try {
      url = new window.URL(target.getAttribute('href'))
    } catch (ex) {
      return defaultValue
    }

    return url
  }

  /**
  * Converts an atom xml entry to a thread
  * @param entry: the entry element
  * @return json structure
  */
  static _atomXMLGmailMessageEntryToThread (entry) {
    const authorEmail = this._atomXMLGetString(entry, 'author>email')
    const authorString = [
      this._atomXMLGetString(entry, 'author>name'),
      authorEmail ? `<${authorEmail}>` : undefined
    ].filter((c) => !!c).join(' ')

    const modifiedTimestamp = this._atomXMLGetDate(entry, 'modified', new Date()).getTime()
    const altUrl = this._atomXMLGetUrl(entry, 'link[rel="alternate"]')

    return {
      historyId: `${modifiedTimestamp}`,
      id: this._atomXMLGetString(entry, 'id'),
      latestMessage: {
        // labelIds: [], these are unavailable
        from: authorString,
        historyId: `${modifiedTimestamp}`,
        id: altUrl ? altUrl.searchParams.get('message_id') : undefined,
        internalDate: modifiedTimestamp,
        snippet: this._atomXMLGetString(entry, 'summary', ''),
        subject: this._atomXMLGetString(entry, 'title', ''),
        to: altUrl ? altUrl.searchParams.get('account_id') : undefined
      }
    }
  }

  /**
  * Fetches the unread count from the atom feed
  * @param partitionId: the id of the partition to run with
  * @param url: the url to fetch
  * @return promise: the unread count or rejection if parsing failed
  */
  static fetchGmailAtomUnreadCount (partitionId, url) {
    return Promise.resolve()
      .then(() => FetchService.request(url, partitionId, {
        credentials: 'include',
        headers: FetchService.DEFAULT_HEADERS
      }))
      .then((res) => res.ok ? Promise.resolve(res) : Promise.reject(res))
      .then((res) => res.text())
      .then((res) => {
        const parser = new window.DOMParser()
        const xmlDoc = parser.parseFromString(res, 'text/xml')
        return Promise.resolve(xmlDoc)
      })
      .then((res) => {
        // TODO test
        const count = this._atomXMLGetInt(res, 'fullcount')
        return count === undefined
          ? Promise.reject(new Error('Count is not a valid'))
          : Promise.resolve(count)
      })
  }

  /**
  * Fetches the unread info from the atom feed
  * @param partitionId: the id of the partition to run with
  * @param url: the url to fetch
  * @return promise { count, timestamp, threads } threads are formatted in api format
  */
  static fetchGmailAtomUnreadInfo (partitionId, url) {
    return Promise.resolve()
      .then(() => FetchService.request(url, partitionId, {
        credentials: 'include',
        headers: FetchService.DEFAULT_HEADERS
      }))
      .then((res) => res.ok ? Promise.resolve(res) : Promise.reject(res))
      .then((res) => res.text())
      .then((res) => {
        const parser = new window.DOMParser()
        const xmlDoc = parser.parseFromString(res, 'text/xml')
        return Promise.resolve(xmlDoc)
      })
      .then((xml) => {
        return Promise.resolve({
          threads: Array.from(xml.querySelectorAll('entry')).map((el) => this._atomXMLGmailMessageEntryToThread(el)),
          count: this._atomXMLGetInt(xml, 'fullcount', 0),
          timestamp: this._atomXMLGetDate(xml, 'modified', new Date()).getTime()
        })
      })
  }
}

export default GoogleHTTP
