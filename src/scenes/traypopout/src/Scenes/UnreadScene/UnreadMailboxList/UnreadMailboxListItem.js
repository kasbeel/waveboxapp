import React from 'react'
import PropTypes from 'prop-types'
import { accountStore } from 'stores/account'
import { ListItem } from '@material-ui/core'
import MailboxBadge from 'wbui/MailboxBadge'
import MailboxAvatar from 'wbui/MailboxAvatar'
import KeyboardArrowRightIcon from '@material-ui/icons/KeyboardArrowRight'
import { withStyles } from '@material-ui/core/styles'
import grey from '@material-ui/core/colors/grey'
import Resolver from 'Runtime/Resolver'
import classNames from 'classnames'

const styles = {
  root: {
    cursor: 'pointer'
  },
  text: {
    width: '100%',
    paddingLeft: 24,
    paddingRight: 24
  },
  primaryText: {
    display: 'inline-block',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    width: '100%',
    lineHeight: '20px',
    fontSize: '16px'
  },
  secondaryText: {
    display: 'inline-block',
    lineHeight: '16px',
    fontSize: '14px',
    color: grey[500]
  },
  forwardArrow: {
    color: grey[400]
  }
}

@withStyles(styles)
class UnreadMailboxListItem extends React.Component {
  /* **************************************************************************/
  // Class
  /* **************************************************************************/

  static propTypes = {
    mailboxId: PropTypes.string.isRequired,
    requestShowMailbox: PropTypes.func.isRequired,
    requestSwitchMailbox: PropTypes.func.isRequired
  }

  /* **************************************************************************/
  // Component Lifecycle
  /* **************************************************************************/

  componentDidMount () {
    accountStore.listen(this.mailboxesChanged)
  }

  componentWillUnmount () {
    accountStore.unlisten(this.mailboxesChanged)
  }

  componentWillReceiveProps (nextProps) {
    if (this.props.mailboxId !== nextProps.mailboxId) {
      this.setState(this.generateMailboxState(nextProps.mailboxId))
    }
  }

  /* **************************************************************************/
  // Data Lifecycle
  /* **************************************************************************/

  state = (() => {
    return {
      ...this.generateMailboxState(this.props.mailboxId)
    }
  })()

  mailboxesChanged = (mailboxState) => {
    this.setState(this.generateMailboxState(this.props.mailboxId, mailboxState))
  }

  /**
  * Generates the mailbox state
  * @param mailboxId: the id of the mailbox
  * @param accountState=autoget: the current store state
  * @return the mailbox state
  */
  generateMailboxState (mailboxId, accountState = accountStore.getState()) {
    return {
      mailbox: accountState.getMailbox(mailboxId),
      unreadCount: accountState.userUnreadCountForMailbox(mailboxId),
      avatar: accountState.getMailboxAvatarConfig(mailboxId)
    }
  }

  /* **************************************************************************/
  // Rendering
  /* **************************************************************************/

  render () {
    const { mailboxId, requestSwitchMailbox, requestShowMailbox, classes, className, ...passProps } = this.props
    const { mailbox, avatar, unreadCount } = this.state

    return (
      <ListItem
        button
        className={classNames(classes.root, className)}
        onClick={(evt) => requestShowMailbox(evt, mailboxId)}
        {...passProps}>
        <MailboxBadge mailbox={mailbox} unreadCount={unreadCount}>
          <MailboxAvatar
            avatar={avatar}
            resolver={(i) => Resolver.image(i)}
            size={40}
            onClick={(evt) => {
              evt.preventDefault()
              evt.stopPropagation()
              requestSwitchMailbox(evt, mailboxId)
            }} />
        </MailboxBadge>
        <span className={classes.text}>
          <span className={classes.primaryText}>{mailbox.displayName || 'Untitled'}</span>
        </span>
        <KeyboardArrowRightIcon className={classes.forwardArrow} />
      </ListItem>
    )
  }
}

export default UnreadMailboxListItem
