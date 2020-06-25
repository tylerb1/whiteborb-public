import { shallowMount } from '@vue/test-utils';
import Whiteborb from '@/components/Whiteborb.vue';

describe('Whiteborb.vue', () => {
  it('renders props.msg when passed', () => {
    const msg = 'new message';
    const wrapper = shallowMount(Whiteborb, {
      propsData: { msg },
    });
    expect(wrapper.text()).toMatch(msg);
  });
});
