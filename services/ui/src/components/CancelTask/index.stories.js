import React from 'react';
import { action } from '@storybook/addon-actions';
import { CancelTaskButton as CancelTask } from './index';

export default {
  component: CancelTask,
  title: 'Components/CancelTask',
};

const rest = {
  action: action('button-clicked'),
  success: false,
  loading: false,
  error: false,
};

export const Default = () => (
  <CancelTask
    task={{id: 42}}
    {...rest}
  />
);

export const Loading = () => (
  <CancelTask
    task={{id: 42}}
    {...rest}
    loading
  />
);

export const Success = () => (
  <CancelTask
    task={{id: 42}}
    {...rest}
    success
  />
);

export const Error = () => (
  <CancelTask
    task={{id: 42}}
    {...rest}
    error
  />
);
