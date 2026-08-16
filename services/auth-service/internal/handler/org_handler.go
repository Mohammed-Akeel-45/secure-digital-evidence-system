package handlerauth

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/gorilla/mux"
)

func (h *AuthHandler) ResolveOrgByPublicID(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	vars := mux.Vars(r)
	publicID := vars["public_id"]

	org, err := h.Store.GetOrgByPublicID(ctx, publicID)
	if err != nil {
		slog.ErrorContext(ctx, "Failed to get organisation by public ID", "error", err, "public_id", publicID)
		http.Error(w, "Failed to get organisation", http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]int64{"id": org.ID})
}
