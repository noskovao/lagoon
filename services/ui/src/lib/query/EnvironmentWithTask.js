import gql from 'graphql-tag';

export default gql`
  query getEnvironment($openshiftProjectName: String!, $taskId: Int!) {
    environment: environmentByOpenshiftProjectName(
      openshiftProjectName: $openshiftProjectName
    ) {
      id
      name
      openshiftProjectName
      project {
        name
        problemsUi
        factsUi
      }
      tasks(id: $taskId) {
        id
        name
        status
        created
        service
        environment {
          id
        }
        logs
        files {
          id
          filename
          download
        }
      }
    }
  }
`;
