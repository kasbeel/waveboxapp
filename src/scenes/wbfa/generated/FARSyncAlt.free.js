import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSyncAlt } from '@fortawesome/free-solid-svg-icons/faSyncAlt'
export default class FARSyncAlt extends React.Component {
  render () {
    return (<FontAwesomeIcon {...this.props} icon={faSyncAlt} />)
  }
}
