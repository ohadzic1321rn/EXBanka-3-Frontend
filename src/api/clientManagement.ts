import api from './client'

export interface ClientListItem {
  id: string
  ime: string
  prezime: string
  email: string
  brojTelefona: string
  adresa: string
  aktivan: boolean
}

export interface ClientDetail {
  id: string
  ime: string
  prezime: string
  datumRodjenja: string
  pol: string
  email: string
  brojTelefona: string
  adresa: string
  aktivan: boolean
}

export interface UpdateClientPayload {
  ime: string
  prezime: string
  datumRodjenja: number
  pol: string
  email: string
  brojTelefona: string
  adresa: string
}

export interface CreateClientPayload {
  ime: string
  prezime: string
  datumRodjenja: number
  pol: string
  email: string
  brojTelefona: string
  adresa: string
}

export const clientManagementApi = {
  list: (params: {
    emailFilter?: string
    nameFilter?: string
    page?: number
    pageSize?: number
  }) => api.get('/clients', { params }),

  get: (id: string) => api.get(`/clients/${id}`),

  update: (id: string, data: UpdateClientPayload) => api.put(`/clients/${id}`, data),

  create: (data: CreateClientPayload) => api.post('/clients', data),
}
