import * as R from 'ramda';
import { Pool } from 'mariadb';
import { asyncPipe } from '@lagoon/commons/dist/util';
import { sendToLagoonLogs } from '@lagoon/commons/dist/logs';
import { createTaskTask, createMiscTask } from '@lagoon/commons/dist/tasks';
import { knex, query } from '../../util/db';
import { pubSub } from '../../clients/pubSub';
import { Sql } from './sql';
import { EVENTS } from './events';
import { Sql as projectSql } from '../project/sql';
import { Sql as environmentSql } from '../environment/sql';
import { Helpers as environmentHelpers } from '../environment/helpers';

export const Helpers = (sqlClientPool: Pool, hasPermission) => {
  const getTaskById = async (TaskID: number) => {
    const queryString = knex('task')
      .where('id', '=', TaskID)
      .toString();

    const rows = await query(sqlClientPool, queryString);
    const task = R.prop(0, rows);

    if (!task) {
      return null;
    }

    const rowsPerms = await query(sqlClientPool, Sql.selectPermsForTask(task.id));
    await hasPermission('task', 'view', {
      project: R.path(['0', 'pid'], rowsPerms)
    });

    return task;
  };

  return {
    addTask: async ({
      id,
      name,
      status,
      created,
      started,
      completed,
      environment,
      service,
      command,
      remoteId,
      execute
    }: {
      id?: number;
      name: string;
      status?: string;
      created?: string;
      started?: string;
      completed?: string;
      environment: number;
      service: string;
      command: string;
      remoteId?: string;
      execute: boolean;
    }) => {
      const { insertId } = await query(
        sqlClientPool,
        Sql.insertTask({
          id,
          name,
          status,
          created,
          started,
          completed,
          environment,
          service,
          command,
          remoteId,
        }),
      );

      let rows = await query(sqlClientPool, Sql.selectTask(insertId));
      const taskData = R.prop(0, rows);

      pubSub.publish(EVENTS.TASK.ADDED, taskData);

      // Allow creating task data w/o executing the task
      if (execute === false) {
        return taskData;
      }

      rows = await query(
        sqlClientPool,
        environmentSql.selectEnvironmentById(taskData.environment)
      );
      const environmentData = R.prop(0, rows);

      rows = await query(
        sqlClientPool,
        projectSql.selectProject(environmentData.project)
      );
      const projectData = R.prop(0, rows);

      taskData.id = taskData.id.toString();

      try {
        await createTaskTask({
          task: taskData,
          project: projectData,
          environment: environmentData
        });
      } catch (error) {
        sendToLagoonLogs(
          'error',
          projectData.name,
          '',
          'api:addTask',
          { taskId: taskData.id },
          `*[${projectData.name}]* Task not initiated, reason: ${error}`
        );
      }

      return taskData;
    },
    addAdvancedTask: async (
      {
        id,
        name,
        status,
        created,
        started,
        completed,
        environment,
        service,
        image,
        payload = {},
        remoteId,
        execute,
      }: {
        id?: number,
        name: string,
        status?: string,
        created?: string,
        started?: string,
        completed?: string,
        environment: number,
        service: string,
        image: string,
        payload: object,
        remoteId?: string,
        execute: boolean,
      },
    ) => {
      let rows = await query(
        sqlClientPool,
        environmentSql.selectEnvironmentById(environment),
      );
      const environmentData = R.prop(0, rows);

      rows = await query(
        sqlClientPool,
        projectSql.selectProject(environmentData.project),
      );
      const projectData = R.prop(0, rows);


      const  queryresp = await query(
        sqlClientPool,
        Sql.insertTask({
          id,
          name,
          status,
          created,
          started,
          completed,
          environment,
          service,
          command: image,
          remoteId,
          type: 'advanced',
          advanced_image: image,
          advanced_payload: JSON.stringify(payload),
        }),
      );

      const { insertId } = queryresp;
      rows = await query(sqlClientPool, Sql.selectTask(insertId));
      const taskData = R.prop(0, rows);
      const ADVANCED_TASK_EVENT_TYPE = "task:advanced"

      taskData.id = taskData.id.toString();

      let jobSpec = {
        task: taskData,
        project: projectData,
        environment: environmentData,
        advancedTask: {
          RunnerImage: image,
          JSONPayload: new Buffer(JSON.stringify(payload).replace(/\\n/g, "\n")).toString('base64')
        }
      }

      pubSub.publish(EVENTS.TASK.ADDED, jobSpec);

      try {
        await createMiscTask(
          {
            key: ADVANCED_TASK_EVENT_TYPE,
            data: jobSpec
          }
        )
      } catch (error) {
        sendToLagoonLogs(
          'error',
          projectData.name,
          '',
          'api:addTask',
          { taskId: taskData.id },
          `*[${projectData.name}]* Task not initiated, reason: ${error}`,
        );
      }

      return taskData;
    },
    getTaskByTaskInput: async taskInput => {
      const notEmpty = R.complement(R.anyPass([R.isNil, R.isEmpty]));
      const hasId = R.both(R.has('id'), R.propSatisfies(notEmpty, 'id'));
      const hasName = R.both(R.has('name'), R.propSatisfies(notEmpty, 'name'));
      const hasEnvironment = R.both(
        R.has('environment'),
        R.propSatisfies(notEmpty, 'environment')
      );
      // @ts-ignore
      const hasNameAndEnvironment = R.both(hasName, hasEnvironment);

      const taskFromId = asyncPipe(
          R.prop('id'),
          getTaskById,
          task => {
            if (!task) {
              throw new Error('Unauthorized');
            }

            return task;
          }
        );

        const taskFromNameEnv = async input => {
          const environments = await environmentHelpers(
            sqlClientPool
          ).getEnvironmentsByEnvironmentInput(R.prop('environment', input));
          const activeEnvironments = R.filter(
            R.propEq('deleted', '0000-00-00 00:00:00'),
            environments
          );

          if (activeEnvironments.length < 1 || activeEnvironments.length > 1) {
            throw new Error('Unauthorized');
          }

          const environment = R.prop(0, activeEnvironments);

          const rows = await query(
            sqlClientPool,
            Sql.selectTaskByNameAndEnvironment(
              R.prop('name', input),
              environment.id
            )
          );

          if (!R.prop(0, rows)) {
            throw new Error('Unauthorized');
          }

          return R.prop(0, rows);
        };

        return R.cond([
          [hasId, taskFromId],
          // @ts-ignore
          [hasNameAndEnvironment, taskFromNameEnv],
          [
            R.T,
            () => {
              throw new Error(
                'Must provide task (id) or (name and environment)'
              );
            }
          ]
        // @ts-ignore
        ])(taskInput);
    }
  };
};
