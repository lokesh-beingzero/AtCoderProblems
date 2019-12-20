import React from "react";
import { useParams, useHistory, Redirect } from "react-router-dom";
import { connect, PromiseState } from "react-refetch";
import { VirtualContest } from "./types";
import {
  Button,
  Row,
  Table,
  Col,
  Spinner,
  Alert,
  ButtonGroup
} from "reactstrap";
import * as CachedApi from "../../../utils/CachedApiClient";
import { List, Map } from "immutable";
import { ProblemId } from "../../../interfaces/Status";
import Problem from "../../../interfaces/Problem";
import { formatProblemUrl } from "../../../utils/Url";
import { CONTEST_JOIN, contestGetUrl, USER_GET } from "../ApiUrl";
import Submission from "../../../interfaces/Submission";

interface ShowingVirtualContest extends VirtualContest {
  map: Map<ProblemId, List<Submission>>;
}

interface UserInfo {
  internal_user_id: string;
  atcoder_user_id: string;
}

interface OuterProps {
  contestId: string;
}

interface InnerProps extends OuterProps {
  contestInfoFetch: PromiseState<ShowingVirtualContest>;
  userInfoGet: PromiseState<UserInfo>;
  joinContest: () => void;
  joinContestPost: PromiseState<{} | null>;
  problemMapFetch: PromiseState<Map<ProblemId, Problem>>;
}

const ShowContest = connect<OuterProps, InnerProps>(props => {
  return {
    userInfoGet: {
      url: USER_GET
    },
    contestInfoFetch: {
      url: contestGetUrl(props.contestId),
      then: contest => {
        const users: string[] = contest.participants;
        return {
          value: CachedApi.cachedUsersSubmissionMap(List(users)).then(map => ({
            map,
            ...contest
          }))
        };
      }
    },
    problemMapFetch: {
      comparison: null,
      value: () => CachedApi.cachedProblemMap()
    },
    joinContest: () => ({
      joinContestPost: {
        url: CONTEST_JOIN,
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ contest_id: props.contestId }),
        andThen: () => ({
          contestInfoFetch: {
            url: contestGetUrl(props.contestId),
            force: true,
            refreshing: true
          }
        })
      }
    }),
    joinContestPost: { value: null }
  };
})(props => {
  const history = useHistory();
  const { contestInfoFetch, userInfoGet, problemMapFetch } = props;

  if (contestInfoFetch.pending) {
    return <Spinner style={{ width: "3rem", height: "3rem" }} />;
  } else if (contestInfoFetch.rejected) {
    return <Alert color="danger">Failed to fetch contest info.</Alert>;
  }

  const problemMap = problemMapFetch.fulfilled
    ? problemMapFetch.value
    : Map<ProblemId, Problem>();
  const contestInfo = contestInfoFetch.value;
  const atcoderUserId = userInfoGet.fulfilled
    ? userInfoGet.value.atcoder_user_id
    : null;
  const internalUserId = userInfoGet.fulfilled
    ? userInfoGet.value.internal_user_id
    : null;
  const alreadyJoined =
    atcoderUserId != null && contestInfo.participants.includes(atcoderUserId);
  const isOwner = contestInfo.owner_user_id === internalUserId;

  return (
    <>
      <Row className="my-2">
        <Col sm="12">
          <h1>{contestInfo.title}</h1>
          <ButtonGroup>
            {!alreadyJoined && atcoderUserId !== null ? (
              <Button onClick={() => props.joinContest()}>Join</Button>
            ) : null}
            {isOwner ? (
              <Button
                onClick={() =>
                  history.push({
                    pathname: `/contest/update/${contestInfo.id}`
                  })
                }
              >
                Edit
              </Button>
            ) : null}
          </ButtonGroup>
        </Col>
      </Row>

      <Row className="my-2">
        <Col sm="12">
          <Table striped>
            <thead>
              <tr>
                <th>Participant</th>
                {contestInfo.problems.map(problemId => {
                  const problem = problemMap.get(problemId, null);
                  return (
                    <th key={problemId}>
                      {problem ? (
                        <a
                          target="_blank"
                          rel="noopener noreferrer"
                          href={formatProblemUrl(
                            problem.id,
                            problem.contest_id
                          )}
                        >
                          {problem.title}
                        </a>
                      ) : (
                        problemId
                      )}
                    </th>
                  );
                })}
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {contestInfo.participants.map(userId => {
                return (
                  <tr key={userId}>
                    <th>{userId}</th>
                    {contestInfo.problems.map(problemId => (
                      <td key={problemId}>
                        {userId} {problemId}
                      </td>
                    ))}
                    <td>0</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Col>
      </Row>
    </>
  );
});

export default () => {
  const { contestId } = useParams();
  if (contestId) {
    return <ShowContest contestId={contestId} />;
  } else {
    return <Redirect to="/contest/recent" />;
  }
};