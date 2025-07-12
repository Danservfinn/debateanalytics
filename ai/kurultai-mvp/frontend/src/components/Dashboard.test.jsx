import { render } from '@testing-library/react';
import Dashboard from './Dashboard';

test('renders Dashboard', () => {
  const { getByText } = render(<Dashboard />);
  expect(getByText('Kurultai Dashboard')).toBeInTheDocument();
}); 