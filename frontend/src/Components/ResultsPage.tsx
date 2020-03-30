import { connectToWebSocket, WebSocketConsumer } from './WebSocket.js';
import { css } from '../css.js';
import { CardValue, WebSocketApi } from '../types/WebSocket.js';
import { compareVotes } from './compareVotes.js';
import React from '../react.js';
import { BORDER_RADIUS, TNG_BLUE } from '../styles.js';

const styling = css`
  display: flex;
  flex-direction: column;
  margin: auto;
  align-items: center;
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  align-content: center;
  justify-content: center;
 
  .heading {
    color: ${TNG_BLUE};
    font-size: 20px;
    text-align: center;
    line-height: 1.2;
  }
  
  .table {
    text-align: left;
    padding: 15px;
    border-width: 3px;
    border-style: solid;
    border-color: ${TNG_BLUE};
    ${BORDER_RADIUS};
    margin: 10px;
  }
  
  .header-row {
    color: ${TNG_BLUE};
    padding 25px;
  }
  
  .button {
    border: none;
    color: white;
    cursor: pointer;
    background: ${TNG_BLUE};
    ${BORDER_RADIUS}
    height: 50px;
    width: 150px;
  }
`;

const getSortedResultsArray = (unsortedResults) => {
    let dataArray: [string, CardValue][] = Object.entries(unsortedResults);
    return dataArray.sort(compareVotes)
};

const ProtoResultsPage = ({ socket }: { socket: WebSocketApi }) =>
  <div className={styling}>
    <div className="heading">RESULTS</div>
    <table className="table">
      <thead>
        <tr className="header-row">
          <th>Name</th>
          <th>Vote</th>
        </tr>
      </thead>
      <tbody>
        {getSortedResultsArray(socket.state.votes).map((userAndVote) => {
            return <tr key={userAndVote[0]}>
            <td>{userAndVote[0]}</td>
            <td>{userAndVote[1]}</td>
          </tr>;
        })}
      </tbody>
    </table>
    <button
      className="button"
      onClick={() => {
        socket.resetVotes();
      }}
    >
      Reset votes
    </button>
  </div>;

export const ResultsPage = connectToWebSocket(ProtoResultsPage);
