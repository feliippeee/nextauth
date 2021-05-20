import Router from 'next/router';
import { setCookie, parseCookies, destroyCookie } from 'nookies';
import { createContext, ReactNode, useState, useEffect} from 'react';
import { api } from '../services/apiClient';

type User = {
    email: string;
    permissions: string[];
    roles: string[];
}

type SignInCredentials = {
    email: string;
    password: string;
}

type AuthContextData = {
    signIn:(credentials: SignInCredentials) => Promise<void>;
    signOut:() => void;
    user: User;
    isAuthenticated: boolean;
};

type AuthProviderProps = {
    children: ReactNode;
}

export const AuthContext= createContext({} as AuthContextData)

let authChannel: BroadcastChannel

export function signOut() {
        destroyCookie(undefined, 'nextauth.token' )
        destroyCookie(undefined, 'nextauth.refreshToken')

        authChannel.postMessage('signOut');

        Router.push('/')
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User>();
    const isAuthenticated = !!user; //verificando se o usuário está autenticado

    useEffect(() => {
        authChannel =  new BroadcastChannel('auth')
        authChannel.onmessage = (message) => {
           switch (message.data) {
               case 'signOut':
                   signOut();
                   authChannel.close();
                   break;   
                default:
                    break;   
           }
        }
    },[])

    useEffect(() => { //useEffect nunca roda pelo lado servidor, sempre pelo lado do browser
        const {'nextauth.token': token} = parseCookies() 
        
        if (token) {
            api.get('/me')
                .then(response => {
                const {email, permissions, roles} = response.data;
               
                setUser({ email, permissions, roles})
                // console.log(response); // voltar recuperando estado da autent.. 5:24
            })
            .catch(() => {
               signOut();
            })
        }
    }, [])

   

    async function signIn({email, password}: SignInCredentials) {
      try {
        const response = await api.post('sessions', { 
            email, 
            password,
        })
        const { token, refreshToken, permissions, roles } = response.data;

        setCookie(undefined, 'nextauth.token', token, {
            maxAge: 60 * 60 * 24 * 30, //30 dias
            path: '/',
        });
        setCookie(undefined, 'nextauth.refreshToken', refreshToken, {
            maxAge: 60 * 60 * 24 * 30, //30 dias
            path: '/',
        });
        
        setUser({
            email,
            permissions,
            roles,
        })

        api.defaults.headers['Authorization'] = `Bearer ${token}`;

        Router.push('/dashboard');

      //  authChannel.postMessage('signIn')
        
    }catch (err) {
        console.log(err);
    }
}
    return (
        <AuthContext.Provider value={{ signIn, signOut, isAuthenticated, user}}>
            {children}
        </AuthContext.Provider>
    )
}