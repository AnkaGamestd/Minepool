package com.minepool.game;

import android.os.CancellationSignal;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;
import androidx.credentials.CredentialManagerCallback;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

@CapacitorPlugin(name = "GoogleAuth")
public class GoogleAuthPlugin extends Plugin {
    private CredentialManager credentialManager;

    @Override
    public void load() {
        credentialManager = CredentialManager.create(getContext());
    }

    @PluginMethod
    public void autoSignIn(PluginCall call) {
        requestCredential(call, true);
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        requestCredential(call, false);
    }

    private void requestCredential(PluginCall call, boolean authorizedOnly) {
        String clientId = getContext().getString(R.string.google_web_client_id);
        if (clientId.isEmpty() || "UNCONFIGURED".equals(clientId)) {
            call.reject("Google sign-in is not configured for this build", "GOOGLE_NOT_CONFIGURED");
            return;
        }

        GetCredentialRequest.Builder requestBuilder = new GetCredentialRequest.Builder();
        if (authorizedOnly) {
            requestBuilder.addCredentialOption(new GetGoogleIdOption.Builder()
                .setFilterByAuthorizedAccounts(true)
                .setAutoSelectEnabled(true)
                .setServerClientId(clientId)
                .build());
        } else {
            requestBuilder.addCredentialOption(new GetSignInWithGoogleOption.Builder(clientId).build());
        }

        credentialManager.getCredentialAsync(
            getActivity(),
            requestBuilder.build(),
            new CancellationSignal(),
            ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse result) {
                    resolveCredential(call, result.getCredential());
                }

                @Override
                public void onError(@NonNull GetCredentialException error) {
                    if (authorizedOnly && error instanceof NoCredentialException) {
                        JSObject result = new JSObject();
                        result.put("authenticated", false);
                        call.resolve(result);
                        return;
                    }
                    call.reject(error.getMessage() == null ? "Google sign-in failed" : error.getMessage(), "GOOGLE_SIGN_IN_FAILED", error);
                }
            }
        );
    }

    private void resolveCredential(PluginCall call, Credential credential) {
        if (!(credential instanceof CustomCredential) ||
            !GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
            call.reject("Unexpected credential type", "INVALID_GOOGLE_CREDENTIAL");
            return;
        }
        try {
            GoogleIdTokenCredential google = GoogleIdTokenCredential.createFrom(((CustomCredential) credential).getData());
            JSObject result = new JSObject();
            result.put("authenticated", true);
            result.put("idToken", google.getIdToken());
            result.put("email", google.getId());
            result.put("displayName", google.getDisplayName());
            result.put("avatarUrl", google.getProfilePictureUri() == null ? null : google.getProfilePictureUri().toString());
            call.resolve(result);
        } catch (RuntimeException error) {
            call.reject("Google returned an invalid ID token", "INVALID_GOOGLE_TOKEN", error);
        }
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        credentialManager.clearCredentialStateAsync(
            new ClearCredentialStateRequest(),
            new CancellationSignal(),
            ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<Void, ClearCredentialException>() {
                @Override public void onResult(Void result) { call.resolve(); }
                @Override public void onError(@NonNull ClearCredentialException error) { call.reject("Could not clear Google credentials", "GOOGLE_SIGN_OUT_FAILED", error); }
            }
        );
    }
}
