import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ClientLoginView from '../../views/client/ClientLoginView.vue'
import { useClientAuthStore } from '../../stores/clientAuth'

const mockPush = vi.fn()

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: mockPush }) }
})

vi.mock('../../api/clientAuth', () => ({
  clientAuthApi: { login: vi.fn() },
}))

describe('ClientLoginView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('renders login form with email input, password input, and submit button', () => {
    const wrapper = mount(ClientLoginView)
    expect(wrapper.find('input[type="email"]').exists()).toBe(true)
    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
    expect(wrapper.find('button[type="submit"]').exists()).toBe(true)
  })

  it('calls store.login with credentials and redirects to /client/dashboard on success', async () => {
    const store = useClientAuthStore()
    const loginSpy = vi.spyOn(store, 'login').mockResolvedValueOnce(undefined)

    const wrapper = mount(ClientLoginView)
    await wrapper.find('input[type="email"]').setValue('ana@gmail.com')
    await wrapper.find('input[type="password"]').setValue('password123')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(loginSpy).toHaveBeenCalledWith('ana@gmail.com', 'password123')
    expect(mockPush).toHaveBeenCalledWith('/client/dashboard')
  })

  it('shows error message when login fails', async () => {
    const store = useClientAuthStore()
    vi.spyOn(store, 'login').mockRejectedValueOnce({
      response: { data: { message: 'Invalid credentials' } },
    })

    const wrapper = mount(ClientLoginView)
    await wrapper.find('input[type="email"]').setValue('bad@gmail.com')
    await wrapper.find('input[type="password"]').setValue('wrongpass')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('.global-error').exists()).toBe(true)
    expect(wrapper.find('.global-error').text()).toContain('Invalid credentials')
  })
})
