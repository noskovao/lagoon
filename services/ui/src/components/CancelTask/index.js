import React from 'react';
import { Mutation } from 'react-apollo';
import gql from 'graphql-tag';
import Button from 'components/Button';

const CANCEL_TASK_MUTATION = gql`
  mutation cancelTask(
    $taskId: Int!,
    $taskName: String!,
    $taskEnvironment: Int!
  ) {
    cancelTask(input: {
      task: {
        id: $taskId,
        name: $taskName,
        environment: $taskEnvironment
      }
    })
  }
`;

export const CancelTaskButton = ({
  action,
  success,
  loading,
  error,
  beforeText,
  afterText
}) => (
  <>
    <Button action={action} disabled={loading || success}>
      {success ? afterText || 'Cancellation requested' : beforeText || 'Cancel Task'}
    </Button>

    {error && (
      <div className="task_result">
        <p>There was a problem cancelling this task.</p>
        <p>{error.message}</p>
      </div>
    )}
  </>
);

const CancelTask = ({ task, beforeText, afterText }) => {
  return (
    <Mutation
      mutation={CANCEL_TASK_MUTATION}
      variables={{
        taskId: task.id,
        taskName: task.name,
        taskEnvironment: task.environment.id
      }}
    >
      {(cancelTask, { loading, error, data }) => (
        <CancelTaskButton
          action={cancelTask}
          success={data && data.cancelTask === 'success'}
          loading={loading}
          error={error}
          beforeText={beforeText}
          afterText={afterText}
        />
      )}
    </Mutation>
  )
};

export default CancelTask;
