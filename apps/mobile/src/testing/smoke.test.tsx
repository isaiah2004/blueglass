/**
 * Proof that the component harness itself works.
 *
 * If this file fails, nothing else in the `component` project can be trusted: the failure
 * is the alias, the environment, or the renderer, not the component under test.
 */

import { describe, expect, it } from 'vitest';
import { Text, View } from 'react-native';

import { renderComponent } from './render';

describe('the component harness', () => {
  it('renders a React Native tree into the DOM', () => {
    const rendered = renderComponent(
      <View testID="box">
        <Text>Atlas</Text>
      </View>,
    );

    expect(rendered.byTestId('box')).not.toBeNull();
    expect(rendered.text()).toBe('Atlas');
    rendered.unmount();
  });
});
